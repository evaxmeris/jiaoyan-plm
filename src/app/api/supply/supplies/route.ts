import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse } from '@/lib/api-response'

// GET /api/supply/supplies — 物资列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'supply.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''

  const where: any = { isActive: true }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { specification: { contains: q } },
      { supplier: { contains: q } },
    ]
  }
  if (category) where.category = category

  const supplies = await prisma.supply.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(successResponse(supplies))
}

// POST /api/supply/supplies — 创建/更新物资
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'supply.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIp(req)
  const { name, category, unit, specification, minStock, supplier, remark } = body

  if (!name || !category) {
    return NextResponse.json({ error: '名称和分类不能为空' }, { status: 400 })
  }

  // 按名称查找，存在则更新，否则创建
  const existing = await prisma.supply.findFirst({ where: { name, isActive: true } })

  let supply
  if (existing) {
    supply = await prisma.supply.update({
      where: { id: existing.id },
      data: { category, unit: unit || '个', specification, minStock: minStock ? Number(minStock) : 0, supplier, remark },
    })
    await writeAuditLog({
      userId: user.id, userName: user.name,
      action: 'UPDATE', entity: 'Supply', entityId: supply.id,
      detail: { name, category },
      ip,
    })
  } else {
    supply = await prisma.supply.create({
      data: { name, category, unit: unit || '个', specification, minStock: minStock ? Number(minStock) : 0, supplier, remark },
    })
    await writeAuditLog({
      userId: user.id, userName: user.name,
      action: 'CREATE', entity: 'Supply', entityId: supply.id,
      detail: { name, category },
      ip,
    })
  }

  return NextResponse.json(successResponse(supply), { status: existing ? 200 : 201 })
}
