import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/supply/traceability/search?keyword=xxx
// 按原料批次号/生产批号/产品名模糊查询，返回完整溯源链路
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'traceability.search', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword') || ''

  if (!keyword || keyword.length < 1) {
    return errorResponse('请输入搜索关键词', 400)
  }

  const ip = extractIp(req)

  // 1. 按产品批次号/备案号搜索 ProductBatch
  const productBatches = await prisma.productBatch.findMany({
    where: {
      OR: [
        { batchNo: { contains: keyword } },
        { registrationNo: { contains: keyword } },
      ],
    },
    include: {
      traceItems: {
        include: {
          rawMaterialBatch: {
            include: {
              rawMaterial: { select: { id: true, nameCn: true, casNo: true, unit: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  // 2. 按原料批次号搜索 RawMaterialBatch
  const rawMaterialBatches = await prisma.rawMaterialBatch.findMany({
    where: {
      OR: [
        { batchNo: { contains: keyword } },
        { internalBatch: { contains: keyword } },
        { supplier: { contains: keyword } },
      ],
    },
    include: {
      rawMaterial: { select: { id: true, nameCn: true, casNo: true, unit: true } },
      productTraceItems: {
        include: {
          productBatch: true,
        },
        take: 10,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  // 3. 按产品名搜索 ProductDesign → 找到关联的 ProductBatch
  const matchedDesigns = await prisma.productDesign.findMany({
    where: {
      name: { contains: keyword },
      isDeleted: false,
    },
    select: { id: true, name: true, brand: true },
    take: 20,
  })

  const designIds = matchedDesigns.map(d => d.id)
  let designProductBatches: any[] = []
  if (designIds.length > 0) {
    designProductBatches = await prisma.productBatch.findMany({
      where: { productId: { in: designIds } },
      include: {
        traceItems: {
          include: {
            rawMaterialBatch: {
              include: {
                rawMaterial: { select: { id: true, nameCn: true, casNo: true, unit: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
  }

  // 4. 查找关联的 SalesOrder（通过 productId 关联 ProductDesign）
  // 收集所有涉及的 productId
  const allProductIds = new Set<string>()
  productBatches.forEach(b => allProductIds.add(b.productId))
  designProductBatches.forEach(b => allProductIds.add(b.productId))

  let salesOrdersMap: Record<string, any[]> = {}
  if (allProductIds.size > 0) {
    const orders = await prisma.salesOrder.findMany({
      where: { productId: { in: Array.from(allProductIds) } },
      orderBy: { orderDate: 'desc' },
      take: 100,
    })
    for (const order of orders) {
      const pid = order.productId || ''
      if (!salesOrdersMap[pid]) salesOrdersMap[pid] = []
      salesOrdersMap[pid].push(order)
    }
  }

  // 5. 补充产品名信息（ProductDesign lookup）
  const allDesignIds = Array.from(allProductIds)
  let designMap: Record<string, { id: string; name: string; brand: string | null }> = {}
  if (allDesignIds.length > 0) {
    const designs = await prisma.productDesign.findMany({
      where: { id: { in: allDesignIds }, isDeleted: false },
      select: { id: true, name: true, brand: true },
    })
    for (const d of designs) {
      designMap[d.id] = d
    }
  }

  // 为每个结果附加产品名和销售订单
  const enrichedProductBatches = productBatches.map(b => ({
    ...b,
    productName: designMap[b.productId]?.name || '未知产品',
    productBrand: designMap[b.productId]?.brand || null,
    salesOrders: salesOrdersMap[b.productId] || [],
  }))

  const enrichedDesignBatches = designProductBatches.map(b => ({
    ...b,
    productName: designMap[b.productId]?.name || '未知产品',
    productBrand: designMap[b.productId]?.brand || null,
    salesOrders: salesOrdersMap[b.productId] || [],
    matchedDesign: matchedDesigns.find(d => d.id === b.productId),
  }))

  // 为原料批次结果附加它所属的产品批次信息
  const enrichedRawMaterialBatches = rawMaterialBatches.map(b => ({
    ...b,
    linkedProductBatches: b.productTraceItems.map(pti => ({
      id: pti.productBatch.id,
      batchNo: pti.productBatch.batchNo,
      productionDate: pti.productBatch.productionDate,
      quantity: pti.productBatch.quantity,
    })),
    productTraceItems: undefined, // 清理冗余数据
  }))

  // 写审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'SEARCH',
    entity: 'Traceability',
    detail: { keyword, resultCount: enrichedProductBatches.length + enrichedRawMaterialBatches.length + enrichedDesignBatches.length },
    ip,
  })

  return NextResponse.json(successResponse({
    keyword,
    productBatches: enrichedProductBatches,
    rawMaterialBatches: enrichedRawMaterialBatches,
    designProductBatches: enrichedDesignBatches,
    matchedDesigns,
  }))
}
