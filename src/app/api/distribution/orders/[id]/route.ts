import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// PUT /api/distribution/orders/[id] — 更新订单（编辑或状态变更）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'sales_order.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const order = await prisma.salesOrder.findUnique({ where: { id } })
  if (!order) return errorResponse('订单不存在', 404)

  // 只更新 status — 状态变更
  if (body.status && Object.keys(body).length === 1) {
    // 有效状态流转
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['SHIPPING', 'CANCELLED'],
      SHIPPING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    }
    const allowedNext = validTransitions[order.status] || []
    if (!allowedNext.includes(body.status)) {
      return errorResponse(`不允许从「${order.status}」变更为「${body.status}」`, 400)
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status: body.status },
      include: { channel: { select: { id: true, name: true, type: true } } },
    })

    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'STATUS_CHANGE',
      entity: 'SalesOrder',
      entityId: id,
      detail: { from: order.status, to: body.status, orderNo: order.orderNo },
      ip,
    })

    return NextResponse.json(successResponse({ order: updated }))
  }

  // 编辑订单（修改字段）
  const updated = await prisma.salesOrder.update({
    where: { id },
    data: {
      productName: body.productName ?? undefined,
      productId: body.productId ?? undefined,
      channelId: body.channelId ?? undefined,
      quantity: body.quantity !== undefined ? parseInt(body.quantity, 10) : undefined,
      unitPrice: body.unitPrice !== undefined ? parseFloat(body.unitPrice) : undefined,
      totalAmount:
        body.quantity !== undefined && body.unitPrice !== undefined
          ? parseInt(body.quantity, 10) * parseFloat(body.unitPrice)
          : undefined,
      orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
      trackingNo: body.trackingNo ?? undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
    include: { channel: { select: { id: true, name: true, type: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'SalesOrder',
    entityId: id,
    detail: { orderNo: order.orderNo },
    ip,
  })

  return NextResponse.json(successResponse({ order: updated }))
}

// DELETE /api/distribution/orders/[id] — 硬删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'sales_order.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const order = await prisma.salesOrder.findUnique({ where: { id } })
  if (!order) return errorResponse('订单不存在', 404)

  await prisma.salesOrder.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'SalesOrder',
    entityId: id,
    detail: { orderNo: order.orderNo },
    ip,
  })

  return NextResponse.json(successResponse(null))
}
