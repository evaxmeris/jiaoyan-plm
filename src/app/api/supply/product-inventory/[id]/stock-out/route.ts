import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { StockOutSchema, validateBody } from '@/lib/validation'
import { successResponse, successResponseWithPagination } from '@/lib/api-response'

// POST 出库
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.stock_out', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params

  // 校验批次存在且可用
  const batch = await prisma.productBatch.findUnique({ where: { id } })
  if (!batch || batch.isDeleted) {
    return NextResponse.json({ error: '批次不存在' }, { status: 404 })
  }
  if (batch.quantity <= 0) {
    return NextResponse.json({ error: '该批次库存已为 0，无法出库' }, { status: 400 })
  }

  const validated = await validateBody(req, StockOutSchema)
  if (!validated.success) return validated.response
  const body = validated.data
  const ip = extractIp(req)

  // 校验出库数量
  if (body.quantity > batch.quantity) {
    return NextResponse.json({ error: `出库数量超过当前库存（当前库存：${batch.quantity}）` }, { status: 400 })
  }

  // 事务：创建出库记录 + 更新批次库存和状态
  const [record] = await prisma.$transaction([
    prisma.stockOutRecord.create({
      data: {
        batchId: id,
        quantity: body.quantity,
        reason: body.reason,
        operatorName: body.operatorName,
        remark: body.remark || null,
      },
    }),
    prisma.productBatch.update({
      where: { id },
      data: {
        quantity: { decrement: body.quantity },
        status: batch.quantity - body.quantity === 0 ? 'OUT_OF_STOCK' : batch.status,
      },
    }),
  ])

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'STOCK_OUT',
    entity: 'ProductBatch',
    entityId: id,
    detail: { batchNo: batch.batchNo, quantity: body.quantity, reason: body.reason, operatorName: body.operatorName },
    ip,
  })

  return NextResponse.json(successResponse(record), { status: 201 })
}

// GET 出库记录列表
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

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    prisma.stockOutRecord.findMany({
      where: { batchId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.stockOutRecord.count({ where: { batchId: id } }),
  ])

  return NextResponse.json(successResponseWithPagination(items, { page, limit, total }))
}
