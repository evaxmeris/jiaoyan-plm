import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { ProductBatchSchema, validateBody } from '@/lib/validation'
import { successResponse, successResponseWithPagination } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const lowStock = searchParams.get('lowStock') === 'true'

  const where: any = { isDeleted: false }
  if (status) where.status = status
  if (lowStock) {
    where.minStock = { gt: 0 }
    where.quantity = { lte: prisma.productBatch.fields.minStock }
  }
  if (q) {
    where.OR = [
      { batchNo: { contains: q } },
      { product: { name: { contains: q } } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.productBatch.findMany({
      where,
      include: { product: { select: { id: true, name: true, brand: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productBatch.count({ where }),
  ])

  // 计算低库存和临期标记
  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  let enrichedItems = items.map((item) => ({
    ...item,
    isLowStock: item.quantity <= item.minStock,
    isExpiring: item.expireDate !== null && item.expireDate !== undefined && item.expireDate <= thirtyDaysLater,
  }))

  // 低库存过滤（客户端过滤）
  if (lowStock) {
    enrichedItems = enrichedItems.filter((item: any) => item.isLowStock)
  }

  return NextResponse.json(successResponseWithPagination(enrichedItems, { page, limit, total }))
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const validated = await validateBody(req, ProductBatchSchema)
  if (!validated.success) return validated.response
  const body = validated.data
  const ip = extractIp(req)

  // 验证产品是否存在
  const product = await prisma.productDesign.findUnique({ where: { id: body.productId } })
  if (!product) {
    return NextResponse.json({ error: '产品不存在' }, { status: 404 })
  }

  const item = await prisma.productBatch.create({
    data: {
      productId: body.productId,
      batchNo: body.batchNo,
      productionDate: new Date(body.productionDate),
      expireDate: body.expireDate ? new Date(body.expireDate) : null,
      quantity: body.quantity,
      minStock: body.minStock,
      status: body.status || 'IN_STOCK',
      registrationNo: body.registrationNo || null,
      remark: body.remark || null,
    },
    include: { product: { select: { id: true, name: true, brand: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ProductBatch',
    entityId: item.id,
    detail: { productId: body.productId, batchNo: body.batchNo, quantity: body.quantity, minStock: body.minStock, expireDate: body.expireDate },
    ip,
  })

  return NextResponse.json(successResponse(item), { status: 201 })
}
