import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/purchase/orders/[id] — 采购订单详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          order: false, // 避免循环
        },
      },
      application: {
        select: { id: true, code: true, title: true, status: true },
      },
    },
  })

  if (!order) {
    return errorResponse('采购订单不存在', 404)
  }

  // 获取关联的审计日志
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: 'PurchaseOrder', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(successResponse({ order, auditLogs }))
}

// PUT /api/purchase/orders/[id] — 状态变更
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { status, remark } = body

  // 有效的状态流转
  const validTransitions: Record<string, string[]> = {
    DRAFT: ['ISSUED', 'CANCELLED'],
    ISSUED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PARTIAL', 'COMPLETED', 'CANCELLED'],
    PARTIAL: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  }

  const current = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      application: { select: { code: true } },
    },
  })
  if (!current) {
    return errorResponse('采购订单不存在', 404)
  }

  const allowedNext = validTransitions[current.status]
  if (!allowedNext.includes(status as string)) {
    return errorResponse(
      `不允许从「${current.status}」变更为「${status}」`,
      400
    )
  }

  // 构建更新数据
  const updateData: any = { status }
  if (remark !== undefined) updateData.remark = remark
  if (status === 'ISSUED') updateData.issuedAt = new Date()
  if (status === 'CONFIRMED') updateData.confirmedAt = new Date()
  if (status === 'COMPLETED' || status === 'PARTIAL') updateData.completedAt = new Date()

  // ── COMPLETED: 自动入库 ──
  if (status === 'COMPLETED' && current.status !== 'COMPLETED') {
    await prisma.$transaction(async (tx) => {
      // 更新PO状态
      await tx.purchaseOrder.update({
        where: { id },
        data: { ...updateData, completedAt: new Date() },
      })

      // 遍历PO明细，自动入库
      for (const item of current.items) {
        if (!item.rawMaterialId) continue

        // 生成内部批次号
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const seq = String(Math.floor(Math.random() * 999)).padStart(3, '0')
        const internalBatch = `JY-RM-${date}-${seq}`

        // 创建原料批次
        await tx.rawMaterialBatch.create({
          data: {
            rawMaterialId: item.rawMaterialId,
            batchNo: current.poNo,
            internalBatch,
            purchaseOrderId: current.id,
            quantity: item.quantity,
            receiptDate: new Date(),
            supplier: current.supplierName || '未知供应商',
            status: 'IN_STOCK',
            remark: `PO ${current.poNo} 自动入库 - ${item.name}`,
          },
        })

        // 增加库存
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { currentStock: { increment: item.quantity } },
        })
      }
    })
  } else {
    // 非完成状态，直接更新
    await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
    })
  }

  // 读取更新后的数据
  const updated = await prisma.purchaseOrder.findUnique({
    where: { id },
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
    action: 'STATUS_CHANGE',
    entity: 'PurchaseOrder',
    entityId: id,
    detail: { from: current.status, to: status, poNo: current.poNo },
    ip: extractIp(req),
  })

  return NextResponse.json(successResponse({ order: updated }))
}

// DELETE /api/purchase/orders/[id] — 删除草稿采购订单
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const { id } = await params
  const { writeAuditLog, extractIp } = await import('@/lib/audit')
  const ip = extractIp(req)

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) return NextResponse.json({ error: '采购订单不存在' }, { status: 404 })

  // 只允许删除草稿状态
  if (order.status !== 'DRAFT') {
    return errorResponse('只能删除草稿状态的采购订单', 400)
  }

  await prisma.purchaseOrder.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'PurchaseOrder',
    entityId: id,
    detail: { poNo: order.poNo },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
