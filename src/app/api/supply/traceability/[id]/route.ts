import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/supply/traceability/[id] — 溯源详情（含完整链路）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'traceability.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  // 1. 获取 ProductBatch 详情
  const productBatch = await prisma.productBatch.findUnique({
    where: { id },
    include: {
      traceItems: {
        include: {
          rawMaterialBatch: {
            include: {
              rawMaterial: {
                select: { id: true, nameCn: true, nameEn: true, casNo: true, unit: true, supplier: true },
              },
            },
          },
        },
      },
    },
  })

  if (!productBatch) {
    return errorResponse('溯源记录不存在', 404)
  }

  // 2. 获取关联的 ProductDesign（产品名称/品牌等）
  let productDesign = null
  try {
    productDesign = await prisma.productDesign.findUnique({
      where: { id: productBatch.productId },
      select: { id: true, name: true, brand: true, category: true, capacity: true, status: true },
    })
  } catch {
    // productId 可能不对应有效 productDesign，忽略
  }

  // 3. 查找关联的 SalesOrder（通过 productId）
  const salesOrders = await prisma.salesOrder.findMany({
    where: { productId: productBatch.productId },
    orderBy: { orderDate: 'desc' },
    take: 50,
  })

  // 4. 构建完整链路数据结构
  // 链路：RawMaterialBatch → ProductBatch → SalesOrder
  const traceChain = productBatch.traceItems.map((item) => ({
    id: item.id,
    usagePercentage: item.usagePercentage,
    remark: item.remark,
    rawMaterialBatch: item.rawMaterialBatch
      ? {
          id: item.rawMaterialBatch.id,
          batchNo: item.rawMaterialBatch.batchNo,
          internalBatch: item.rawMaterialBatch.internalBatch,
          quantity: item.rawMaterialBatch.quantity,
          receiptDate: item.rawMaterialBatch.receiptDate,
          expireDate: item.rawMaterialBatch.expireDate,
          supplier: item.rawMaterialBatch.supplier,
          status: item.rawMaterialBatch.status,
          rawMaterial: item.rawMaterialBatch.rawMaterial,
        }
      : null,
  }))

  const result = {
    productBatch: {
      id: productBatch.id,
      productId: productBatch.productId,
      batchNo: productBatch.batchNo,
      productionDate: productBatch.productionDate,
      quantity: productBatch.quantity,
      status: productBatch.status,
      registrationNo: productBatch.registrationNo,
      remark: productBatch.remark,
      createdAt: productBatch.createdAt,
      updatedAt: productBatch.updatedAt,
    },
    productDesign,
    traceChain,
    salesOrders: salesOrders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      productName: order.productName,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      status: order.status,
      trackingNo: order.trackingNo,
    })),
  }

  // 写审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'VIEW',
    entity: 'Traceability',
    entityId: id,
    detail: {
      batchNo: productBatch.batchNo,
      productName: productDesign?.name || '未知',
      salesOrderCount: salesOrders.length,
      rawMaterialCount: traceChain.length,
    },
    ip,
  })

  return NextResponse.json(successResponse(result))
}
