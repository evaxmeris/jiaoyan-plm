import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// 自动生成运单号：SO-{date}-{seq}
async function generateShippingNo(): Promise<string> {
  const now = new Date()
  const prefix = `SO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const last = await prisma.shippingOrder.findFirst({
    where: { shippingNo: { startsWith: prefix } },
    orderBy: { shippingNo: 'desc' },
  })
  let seq = 1
  if (last) {
    const lastSeq = parseInt(last.shippingNo.slice(-4), 10)
    seq = lastSeq + 1
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

// GET /api/logistics/shipping — 发货单列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const salesOrderId = searchParams.get('salesOrderId')

  const where: any = {}
  if (status) where.status = status
  if (salesOrderId) where.salesOrderId = salesOrderId

  const orders = await prisma.shippingOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      salesOrder: {
        select: { id: true, orderNo: true, productName: true, quantity: true, totalAmount: true, status: true },
      },
    },
  })
  return NextResponse.json(successResponse(orders))
}

// POST /api/logistics/shipping — 创建发货单
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  // 验证销售订单是否存在且已确认
  if (!body.salesOrderId) {
    return errorResponse('请选择销售订单', 400)
  }
  const salesOrder = await prisma.salesOrder.findUnique({ where: { id: body.salesOrderId } })
  if (!salesOrder) {
    return errorResponse('销售订单不存在', 404)
  }

  const shippingNo = await generateShippingNo()

  const order = await prisma.shippingOrder.create({
    data: {
      salesOrderId: body.salesOrderId,
      shippingNo,
      logisticsProvider: body.logisticsProvider || null,
      trackingNo: body.trackingNo || null,
      shippingDate: body.shippingDate ? new Date(body.shippingDate) : null,
      estimatedDays: body.estimatedDays ? parseInt(body.estimatedDays, 10) : null,
      status: 'PENDING',
      totalPackage: body.totalPackage ? parseInt(body.totalPackage, 10) : null,
      weight: body.weight ? parseFloat(body.weight) : null,
      volume: body.volume ? parseFloat(body.volume) : null,
      shippingCost: body.shippingCost ? parseFloat(body.shippingCost) : null,
      remark: body.remark || null,
    },
    include: {
      salesOrder: {
        select: { id: true, orderNo: true, productName: true, quantity: true, totalAmount: true, status: true },
      },
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ShippingOrder',
    entityId: order.id,
    detail: { shippingNo: order.shippingNo, salesOrderId: body.salesOrderId },
    ip,
  })

  return NextResponse.json(successResponse(order), { status: 201 })
}
