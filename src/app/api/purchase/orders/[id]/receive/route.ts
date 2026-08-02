import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// POST /api/purchase/orders/[id]/receive — 到货登记
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { items } = body as {
    items: { itemId: string; receivedQty: number }[]
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return errorResponse('请提供收货明细', 400)
  }

  // 获取当前 PO（含明细）
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      application: { select: { code: true } },
    },
  })

  if (!order) {
    return errorResponse('采购订单不存在', 404)
  }

  // 仅 CONFIRMED 或 PARTIAL 状态可收货
  if (order.status !== 'CONFIRMED' && order.status !== 'PARTIAL') {
    return errorResponse(`当前状态「${order.status}」不允许到货登记`, 400)
  }

  // 校验收货明细
  for (const input of items) {
    const orderItem = order.items.find(item => item.id === input.itemId)
    if (!orderItem) {
      return errorResponse(`明细项 ${input.itemId} 不在当前订单中`, 400)
    }
    if (input.receivedQty < 0) {
      return errorResponse(`明细「${orderItem.name}」收货数量不能为负数`, 400)
    }
    const newReceived = orderItem.receivedQty + input.receivedQty
    if (newReceived > orderItem.quantity) {
      return errorResponse(`明细「${orderItem.name}」累计收货 ${newReceived} 超过订购数量 ${orderItem.quantity}`, 400)
    }
  }

  // 执行收货（事务）
  const result = await prisma.$transaction(async (tx) => {
    // 1. 更新各明细的 receivedQty
    for (const input of items) {
      await tx.purchaseOrderItem.update({
        where: { id: input.itemId },
        data: { receivedQty: { increment: input.receivedQty } },
      })
    }

    // 2. 重新查询所有明细判断 PO 状态
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { orderId: id },
    })

    const allFullyReceived = updatedItems.every(item => item.receivedQty >= item.quantity)
    const anyReceived = updatedItems.some(item => item.receivedQty > 0)

    let newStatus: string
    if (allFullyReceived) {
      newStatus = 'COMPLETED'
    } else if (anyReceived) {
      newStatus = 'PARTIAL'
    } else {
      newStatus = order.status // 不应发生，但保持安全
    }

    // 3. 更新 PO 状态
    const updateData: any = { status: newStatus }
    if (newStatus === 'COMPLETED') {
      updateData.completedAt = new Date()
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: updateData,
    })

    // 4. 对每个已收货的原料项：创建批次 + 更新库存
    for (const input of items) {
      const orderItem = order.items.find(item => item.id === input.itemId)
      if (!orderItem || input.receivedQty <= 0) continue

      if (orderItem.rawMaterialId) {
        // 生成内部批次号
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const seq = String(Math.floor(Math.random() * 999)).padStart(3, '0')
        const internalBatch = `JY-RM-${date}-${seq}`

        // 创建原料批次
        await tx.rawMaterialBatch.create({
          data: {
            rawMaterialId: orderItem.rawMaterialId,
            batchNo: order.poNo,
            internalBatch,
            purchaseOrderId: order.id,
            quantity: input.receivedQty,
            receiptDate: new Date(),
            supplier: order.supplierName || '未知供应商',
            status: 'QUARANTINE',
            remark: `PO ${order.poNo} 到货待检 - ${orderItem.name}`,
          },
        })

        // 记录原料采购价格（自动写入价格历史）
        if (orderItem.unitPrice > 0) {
          await tx.rawMaterialPrice.create({
            data: {
              rawMaterialId: orderItem.rawMaterialId,
              price: orderItem.unitPrice,
              unit: orderItem.unit || 'kg',
              supplier: order.supplierName || null,
              purchaseOrderNo: order.poNo,
              recordedAt: new Date(),
            },
          })
        }

        // 不增加库存 — 待 IQC PASS 后才入库
      }
    }

    // 5. 非原料物资处理（仅 COMPLETED 时自动入库）
    if (newStatus === 'COMPLETED') {
      for (const item of updatedItems) {
        if (item.rawMaterialId) continue

        // 非原料采购项 → 按物资自动入库
        // 查找或创建Supply
        let supply = await tx.supply.findFirst({
          where: { name: item.name, isActive: true },
        })

        if (supply) {
          await tx.supply.update({
            where: { id: supply.id },
            data: { currentStock: { increment: item.receivedQty } },
          })
        } else {
          supply = await tx.supply.create({
            data: {
              name: item.name,
              category: 'OTHER',
              unit: item.unit || '个',
              currentStock: item.receivedQty,
            },
          })
        }

        // 创建SupplyBatch
        await tx.supplyBatch.create({
          data: {
            supplyId: supply.id,
            batchNo: order.poNo,
            quantity: item.receivedQty,
            receiptDate: new Date(),
            supplier: order.supplierName || null,
            remark: `PO ${order.poNo} 到货自动入库`,
          },
        })
      }
    }

    return { newStatus, updatedItems }
  })

  // 写入审计日志
  const { writeAuditLog, extractIp } = await import('@/lib/audit')
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'RECEIVE',
    entity: 'PurchaseOrder',
    entityId: id,
    detail: {
      poNo: order.poNo,
      receivedItems: items.map(i => {
        const item = order.items.find(oi => oi.id === i.itemId)
        return { name: item?.name || i.itemId, qty: i.receivedQty }
      }),
      newStatus: result.newStatus,
    },
    ip: extractIp(req),
  })

  // 自动创建到货质检（IQC）- 不影响主流程
  try {
    for (const input of items) {
      if (input.receivedQty <= 0) continue
      const orderItem = order.items.find(item => item.id === input.itemId)
      if (!orderItem || !orderItem.rawMaterialId) continue

      // 查找本次创建的批次
      const batch = await prisma.rawMaterialBatch.findFirst({
        where: {
          rawMaterialId: orderItem.rawMaterialId,
          purchaseOrderId: id,
          batchNo: order.poNo,
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!batch) continue

      // 防止重复创建（同一批次已有IQC则跳过）
      const existingIqc = await prisma.incomingInspection.findFirst({
        where: { batchId: batch.id },
      })
      if (existingIqc) continue

      // 创建IQC记录
      await prisma.incomingInspection.create({
        data: {
          rawMaterialId: orderItem.rawMaterialId,
          batchId: batch.id,
          supplierBatchNo: order.poNo,
          quantityReceived: input.receivedQty,
          unit: orderItem.unit || 'kg',
          receiptDate: new Date(),
          inspector: '系统自动',
          result: 'PENDING',
          remark: `由采购订单 ${order.poNo} 自动创建`,
        },
      })

      // 写入IQC审计日志
      await writeAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'AUTO_IQC_CREATE',
        entity: 'IncomingInspection',
        detail: {
          poNo: order.poNo,
          rawMaterialId: orderItem.rawMaterialId,
          batchId: batch.id,
          quantity: input.receivedQty,
        },
        ip: extractIp(req),
      })
    }
  } catch (error) {
    console.error('[AutoIQC] 自动创建IQC失败:', error)
  }

  // 读取更新后的完整数据返回
  const updatedOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      application: { select: { id: true, code: true, title: true } },
    },
  })

  return NextResponse.json(successResponse({ order: updatedOrder }))
}
