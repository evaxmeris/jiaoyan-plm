import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/logistics/shipping/[id] — 发货单详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const order = await prisma.shippingOrder.findUnique({
    where: { id },
    include: {
      salesOrder: {
        select: { id: true, orderNo: true, productName: true, quantity: true, totalAmount: true, status: true, orderDate: true },
      },
    },
  })
  if (!order) return errorResponse('发货单不存在', 404)

  return NextResponse.json(successResponse(order))
}

// 允许的状态流转
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PICKING'],
  PICKING: ['PACKED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: [],
  RETURNED: [],
}

// PUT /api/logistics/shipping/[id] — 更新发货单（编辑或状态变更）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const order = await prisma.shippingOrder.findUnique({ where: { id } })
  if (!order) return errorResponse('发货单不存在', 404)

  // 状态变更（仅 status 字段）
  if (body.status && Object.keys(body).length === 1) {
    if (!await verifyPermission(user.role, 'shipping.status', user.id)) {
      return errorResponse('无状态流转权限', 403)
    }
    const allowedNext = STATUS_TRANSITIONS[order.status] || []
    if (!allowedNext.includes(body.status)) {
      return errorResponse(`不允许从「${order.status}」变更为「${body.status}」`, 400)
    }

    const updateData: any = { status: body.status }
    if (body.status === 'SHIPPED') {
      updateData.shippingDate = new Date()
    }
    if (body.status === 'DELIVERED') {
      updateData.deliveredDate = new Date()
    }

    const updated = await prisma.shippingOrder.update({
      where: { id },
      data: updateData,
      include: {
        salesOrder: {
          select: { id: true, orderNo: true, productName: true, quantity: true },
        },
      },
    })

    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'STATUS_CHANGE',
      entity: 'ShippingOrder',
      entityId: id,
      detail: { from: order.status, to: body.status, shippingNo: order.shippingNo },
      ip,
    })

    // 如果已签收，自动更新销售订单状态
    if (body.status === 'DELIVERED') {
      await prisma.salesOrder.update({
        where: { id: order.salesOrderId },
        data: { status: 'DELIVERED' },
      })
    }

    return NextResponse.json(successResponse(updated))
  }

  // 编辑发货单
  const updated = await prisma.shippingOrder.update({
    where: { id },
    data: {
      logisticsProvider: body.logisticsProvider !== undefined ? body.logisticsProvider : undefined,
      trackingNo: body.trackingNo !== undefined ? body.trackingNo : undefined,
      shippingDate: body.shippingDate ? new Date(body.shippingDate) : undefined,
      estimatedDays: body.estimatedDays !== undefined ? parseInt(body.estimatedDays, 10) : undefined,
      totalPackage: body.totalPackage !== undefined ? parseInt(body.totalPackage, 10) : undefined,
      weight: body.weight !== undefined ? parseFloat(body.weight) : undefined,
      volume: body.volume !== undefined ? parseFloat(body.volume) : undefined,
      shippingCost: body.shippingCost !== undefined ? parseFloat(body.shippingCost) : undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
    include: {
      salesOrder: {
        select: { id: true, orderNo: true, productName: true, quantity: true },
      },
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ShippingOrder',
    entityId: id,
    detail: { shippingNo: order.shippingNo },
    ip,
  })

  return NextResponse.json({ order: updated })
}

// DELETE /api/logistics/shipping/[id] — 删除发货单
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const order = await prisma.shippingOrder.findUnique({ where: { id } })
  if (!order) return errorResponse('发货单不存在', 404)

  await prisma.shippingOrder.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ShippingOrder',
    entityId: id,
    detail: { shippingNo: order.shippingNo },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
