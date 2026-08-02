import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { successResponse, successResponseWithPagination, errorResponse } from '@/lib/api-response'

// GET /api/purchase/orders — 采购订单列表（分页+按状态筛选）
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const status = searchParams.get('status') // 可选筛选
  const keyword = searchParams.get('keyword') // 按PO编号/供应商搜索

  const where: Prisma.PurchaseOrderWhereInput = {}
  if (status) where.status = status as any
  if (keyword) {
    where.OR = [
      { poNo: { contains: keyword, mode: 'insensitive' } },
      { supplierName: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        items: true,
        application: { select: { code: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  return NextResponse.json(successResponseWithPagination(orders, { page, limit: pageSize, total }))
}

// POST /api/purchase/orders — 从采购申请生成PO
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { applicationId } = body
  if (!applicationId) {
    return errorResponse('缺少 applicationId', 400)
  }

  // 检查采购申请是否存在且已审批
  const app = await prisma.purchaseApplication.findUnique({
    where: { id: applicationId },
    include: { items: true },
  })
  if (!app) {
    return errorResponse('采购申请不存在', 404)
  }
  if (app.status !== 'APPROVED') {
    return errorResponse('采购申请尚未通过审批，无法生成PO', 400)
  }

  // 检查是否已生成PO（一对一关系）
  const existing = await prisma.purchaseOrder.findUnique({
    where: { applicationId },
  })
  if (existing) {
    return NextResponse.json({ success: false, error: '该采购申请已生成PO', poNo: existing.poNo }, { status: 409 })
  }

  // 生成PO编号：PO-YYYY-XXXX（逐年自增）
  const year = new Date().getFullYear()
  const lastPo = await prisma.purchaseOrder.findFirst({
    where: { poNo: { startsWith: `PO-${year}-` } },
    orderBy: { poNo: 'desc' },
    select: { poNo: true },
  })
  let seq = 1
  if (lastPo) {
    const parts = lastPo.poNo.split('-')
    seq = parseInt(parts[parts.length - 1], 10) + 1
  }
  const poNo = `PO-${year}-${String(seq).padStart(4, '0')}`

  // 计算订单总额
  const totalAmount = app.items.reduce(
    (sum, item) => sum + Number(item.totalPrice),
    0
  )

  // 创建PO
  const order = await prisma.purchaseOrder.create({
    data: {
      poNo,
      applicationId,
      supplierId: app.supplierId || null,
      supplierName: app.supplier || '未知供应商',
      totalAmount,
      status: 'DRAFT',
      items: {
        create: app.items.map((item) => ({
          name: item.name,
          rawMaterialId: item.rawMaterialId || null,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: Number(item.estimatedPrice),
          totalPrice: Number(item.totalPrice),
          remark: item.remark || null,
        })),
      },
    },
    include: {
      items: true,
      application: { select: { code: true, title: true } },
    },
  })

  // 写入审计日志
  const { writeAuditLog, extractIp } = await import('@/lib/audit')
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PurchaseOrder',
    entityId: order.id,
    detail: { poNo, applicationId, totalAmount, itemCount: app.items.length },
    ip: extractIp(req),
  })

  return NextResponse.json(successResponse({ order }), { status: 201 })
}
