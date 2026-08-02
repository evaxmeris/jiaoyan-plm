import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// 自动生成订单号：SO + 年月日 + 4位序号
async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const prefix = `SO${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const lastOrder = await prisma.salesOrder.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: 'desc' },
  })
  let seq = 1
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNo.slice(-4), 10)
    seq = lastSeq + 1
  }
  return `${prefix}${String(seq).padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'sales_order.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channelId')
  const status = searchParams.get('status')

  const where: any = {}
  if (channelId) where.channelId = channelId
  if (status) where.status = status

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: { orderDate: 'desc' },
    include: { channel: { select: { id: true, name: true, type: true } } },
  })
  return NextResponse.json(successResponse(orders))
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'sales_order.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  const orderNo = await generateOrderNo()
  const quantity = parseInt(body.quantity, 10)
  const unitPrice = parseFloat(body.unitPrice)
  const totalAmount = quantity * unitPrice

  const order = await prisma.salesOrder.create({
    data: {
      orderNo,
      channelId: body.channelId,
      productId: body.productId || null,
      productName: body.productName,
      quantity,
      unitPrice,
      totalAmount,
      orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
      status: 'PENDING',
      trackingNo: body.trackingNo || null,
      remark: body.remark || null,
    },
    include: { channel: { select: { id: true, name: true, type: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'SalesOrder',
    entityId: order.id,
    detail: { orderNo: order.orderNo, productName: order.productName, totalAmount: order.totalAmount },
    ip,
  })

  return NextResponse.json(successResponse({ order }), { status: 201 })
}
