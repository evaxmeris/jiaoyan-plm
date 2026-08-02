import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse } from '@/lib/api-response'

// GET 详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const item = await prisma.productBatch.findFirst({
    where: { id, isDeleted: false },
    include: { product: { select: { id: true, name: true, brand: true } } },
  })
  if (!item) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  // 计算低库存和临期标记
  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const enriched = {
    ...item,
    isLowStock: item.quantity <= item.minStock,
    isExpiring: item.expireDate !== null && item.expireDate !== undefined && item.expireDate <= thirtyDaysLater,
  }

  return NextResponse.json(successResponse(enriched))
}

// PUT 更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const old = await prisma.productBatch.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  const ip = extractIp(req)
  const data: any = {}
  if (body.batchNo !== undefined) data.batchNo = body.batchNo
  if (body.productionDate !== undefined) data.productionDate = new Date(body.productionDate)
  if (body.expireDate !== undefined) data.expireDate = body.expireDate ? new Date(body.expireDate) : null
  if (body.quantity !== undefined) data.quantity = body.quantity
  if (body.minStock !== undefined) data.minStock = body.minStock
  if (body.status !== undefined) data.status = body.status
  if (body.registrationNo !== undefined) data.registrationNo = body.registrationNo
  if (body.remark !== undefined) data.remark = body.remark

  const item = await prisma.productBatch.update({
    where: { id },
    data,
    include: { product: { select: { id: true, name: true, brand: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ProductBatch',
    entityId: id,
    detail: { changes: Object.keys(data) },
    ip,
  })

  return NextResponse.json(successResponse(item))
}

// DELETE 软删除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.delete', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const old = await prisma.productBatch.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  const ip = extractIp(req)

  await prisma.productBatch.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ProductBatch',
    entityId: id,
    detail: { batchNo: old.batchNo },
    ip,
  })

  return NextResponse.json(successResponse(null))
}

// POST 出库
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const batch = await prisma.productBatch.findUnique({ where: { id } })
  if (!batch) return NextResponse.json({ error: '批次不存在' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  const quantity = parseInt(body.quantity)
  if (!quantity || quantity < 1) return NextResponse.json({ error: '出库数量必须大于 0' }, { status: 400 })
  if (quantity > batch.quantity) return NextResponse.json({ error: '出库数量不能超过当前库存' }, { status: 400 })

  const validReasons = ['SALE', 'DAMAGE', 'RECALL', 'GIFT', 'OTHER']
  const reason = body.reason || 'OTHER'
  if (!validReasons.includes(reason)) return NextResponse.json({ error: '无效的出库原因' }, { status: 400 })

  const ip = extractIp(req)

  const updated = await prisma.productBatch.update({
    where: { id },
    data: { quantity: batch.quantity - quantity },
  })

  await prisma.stockOutRecord.create({
    data: {
      batchId: id,
      quantity,
      reason,
      operatorName: user.name,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ProductBatch',
    entityId: id,
    detail: { action: 'stock-out', quantity, reason },
    ip,
  })

  return NextResponse.json(successResponse(updated))
}

// PATCH 更新状态（标记过期/损坏）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const batch = await prisma.productBatch.findUnique({ where: { id } })
  if (!batch) return NextResponse.json({ error: '批次不存在' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  const validStatuses = ['EXPIRED', 'DAMAGED']
  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: '无效的状态值，仅支持 EXPIRED/DAMAGED' }, { status: 400 })
  }

  const ip = extractIp(req)

  const item = await prisma.productBatch.update({
    where: { id },
    data: { status: body.status },
    include: { product: { select: { id: true, name: true, brand: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ProductBatch',
    entityId: id,
    detail: { action: 'status-change', from: batch.status, to: body.status },
    ip,
  })

  return NextResponse.json(successResponse(item))
}
