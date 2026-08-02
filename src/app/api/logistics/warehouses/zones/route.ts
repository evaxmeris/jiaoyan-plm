import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/logistics/warehouses/zones — 仓位区域列表
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_zone.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const zones = await prisma.warehouseZone.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { locations: true } },
      locations: {
        select: { id: true, code: true, isOccupied: true },
        orderBy: { code: 'asc' },
      },
    },
  })
  return NextResponse.json(successResponse(zones))
}

// POST /api/logistics/warehouses/zones — 创建仓位区域
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_zone.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.name) {
    return errorResponse('区域名称不能为空', 400)
  }

  const zone = await prisma.warehouseZone.create({
    data: {
      name: body.name,
      description: body.description || null,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'WarehouseZone',
    entityId: zone.id,
    detail: { name: zone.name },
    ip,
  })

  return NextResponse.json(successResponse(zone), { status: 201 })
}

// PUT /api/logistics/warehouses/zones — 更新仓位区域
export async function PUT(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_zone.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.id) {
    return errorResponse('缺少区域ID', 400)
  }

  const existing = await prisma.warehouseZone.findUnique({ where: { id: body.id } })
  if (!existing) return errorResponse('区域不存在', 404)

  const updated = await prisma.warehouseZone.update({
    where: { id: body.id },
    data: {
      name: body.name ?? undefined,
      description: body.description !== undefined ? body.description : undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'WarehouseZone',
    entityId: body.id,
    detail: { name: existing.name },
    ip,
  })

  return NextResponse.json(successResponse(updated))
}

// DELETE /api/logistics/warehouses/zones — 删除仓位区域
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_zone.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return errorResponse('缺少区域ID', 400)

  const ip = extractIp(req)

  const zone = await prisma.warehouseZone.findUnique({ where: { id } })
  if (!zone) return errorResponse('区域不存在', 404)

  await prisma.warehouseZone.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'WarehouseZone',
    entityId: id,
    detail: { name: zone.name },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
