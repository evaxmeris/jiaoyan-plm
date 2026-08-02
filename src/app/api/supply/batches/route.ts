import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse } from '@/lib/api-response'

// GET /api/supply/batches — 物资批次列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'supply.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const supplyId = searchParams.get('supplyId') || ''
  const q = searchParams.get('q') || ''

  const where: any = {}
  if (supplyId) where.supplyId = supplyId
  if (q) {
    where.OR = [
      { batchNo: { contains: q } },
      { supplier: { contains: q } },
    ]
  }

  const batches = await prisma.supplyBatch.findMany({
    where,
    include: { supply: { select: { name: true, unit: true, category: true } } },
    orderBy: { receiptDate: 'desc' },
  })
  return NextResponse.json(successResponse(batches))
}

// POST /api/supply/batches — 物资入库
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'supply.stock_in', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIp(req)
  const { supplyId, batchNo, quantity, receiptDate, expireDate, supplier, remark } = body

  if (!supplyId || !batchNo || !quantity) {
    return NextResponse.json({ error: '物资、批次号和数量不能为空' }, { status: 400 })
  }

  // 检查物资是否存在
  const supply = await prisma.supply.findUnique({ where: { id: supplyId } })
  if (!supply) {
    return NextResponse.json({ error: '物资不存在' }, { status: 404 })
  }

  // 创建批次 + 增加库存（事务）
  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.supplyBatch.create({
      data: {
        supplyId,
        batchNo,
        quantity: Number(quantity),
        receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
        expireDate: expireDate ? new Date(expireDate) : null,
        supplier: supplier || null,
        remark: remark || null,
      },
    })

    await tx.supply.update({
      where: { id: supplyId },
      data: { currentStock: { increment: Number(quantity) } },
    })

    return b
  })

  await writeAuditLog({
    userId: user.id, userName: user.name,
    action: 'STOCK_IN', entity: 'SupplyBatch', entityId: batch.id,
    detail: { supplyId, supplyName: supply.name, batchNo, quantity: Number(quantity) },
    ip,
  })

  return NextResponse.json(successResponse(batch), { status: 201 })
}
