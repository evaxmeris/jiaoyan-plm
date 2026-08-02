import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse } from '@/lib/api-response'

// GET /api/supply/traceability?q=xxx — 溯源记录列表，支持按产品批号或备案号搜索
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'traceability.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  const where = q
    ? { OR: [{ batchNo: { contains: q } }, { registrationNo: { contains: q } }] }
    : {}

  const batches = await prisma.productBatch.findMany({
    where,
    include: {
      traceItems: {
        include: {
          rawMaterialBatch: {
            include: { rawMaterial: { select: { nameCn: true, casNo: true, unit: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // 补充产品名称和销售订单信息
  const productIds = [...new Set(batches.map(b => b.productId))]
  let designMap: Record<string, { name: string; brand: string | null }> = {}
  let salesOrdersMap: Record<string, any[]> = {}

  if (productIds.length > 0) {
    const designs = await prisma.productDesign.findMany({
      where: { id: { in: productIds }, isDeleted: false },
      select: { id: true, name: true, brand: true },
    })
    for (const d of designs) {
      designMap[d.id] = { name: d.name, brand: d.brand }
    }

    const orders = await prisma.salesOrder.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, orderNo: true, productName: true, productId: true, quantity: true, totalAmount: true, orderDate: true, status: true },
      orderBy: { orderDate: 'desc' },
      take: 100,
    })
    for (const o of orders) {
      const pid = o.productId || ''
      if (!salesOrdersMap[pid]) salesOrdersMap[pid] = []
      salesOrdersMap[pid].push(o)
    }
  }

  const enrichedBatches = batches.map(b => ({
    ...b,
    productName: designMap[b.productId]?.name || '未知产品',
    productBrand: designMap[b.productId]?.brand || null,
    salesOrders: salesOrdersMap[b.productId] || [],
  }))

  return NextResponse.json(successResponse(enrichedBatches))
}

// POST /api/supply/traceability — 新建产品批次（溯源）
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'traceability.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIp(req)

  const batchNo = `JY-PB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

  const batch = await prisma.productBatch.create({
    data: {
      productId: body.productId,
      batchNo,
      productionDate: new Date(body.productionDate),
      quantity: body.quantity || 0,
      registrationNo: body.registrationNo || null,
      remark: body.remark || null,
      traceItems: {
        create: (body.traceItems || []).map((item: any) => ({
          rawMaterialBatchId: item.rawMaterialBatchId,
          usagePercentage: item.usagePercentage || null,
          remark: item.remark || null,
        })),
      },
    },
    include: {
      traceItems: {
        include: {
          rawMaterialBatch: {
            include: { rawMaterial: { select: { nameCn: true } } },
          },
        },
      },
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ProductBatch',
    entityId: batch.id,
    detail: {
      batchNo: batch.batchNo,
      productId: body.productId,
      traceItemCount: (body.traceItems || []).length,
    },
    ip,
  })

  return NextResponse.json(successResponse({ batch, productName: '' }), { status: 201 })
}
