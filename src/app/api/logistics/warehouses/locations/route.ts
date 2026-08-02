import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/logistics/warehouses/locations — 仓位列表（按区域筛选）
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_location.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const zoneId = searchParams.get('zoneId')

  const where: any = {}
  if (zoneId) where.zoneId = zoneId

  const locations = await prisma.warehouseLocation.findMany({
    where,
    orderBy: [{ zoneId: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(successResponse(locations))
}

// POST /api/logistics/warehouses/locations — 创建仓位
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_location.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.zoneId || !body.code) {
    return errorResponse('区域和仓位编码不能为空', 400)
  }

  // 检查同区域内编码唯一
  const dup = await prisma.warehouseLocation.findUnique({
    where: { zoneId_code: { zoneId: body.zoneId, code: body.code } },
  })
  if (dup) {
    return errorResponse(`区域内已存在编码「${body.code}」`, 400)
  }

  const location = await prisma.warehouseLocation.create({
    data: {
      zoneId: body.zoneId,
      code: body.code,
      description: body.description || null,
      isOccupied: body.isOccupied || false,
      remark: body.remark || null,
    },
    include: {
      zone: { select: { id: true, name: true } },
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'WarehouseLocation',
    entityId: location.id,
    detail: { code: location.code, zoneId: body.zoneId },
    ip,
  })

  return NextResponse.json(successResponse(location), { status: 201 })
}

// PUT /api/logistics/warehouses/locations — 更新仓位
export async function PUT(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_location.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.id) {
    return errorResponse('缺少仓位ID', 400)
  }

  const existing = await prisma.warehouseLocation.findUnique({ where: { id: body.id } })
  if (!existing) return errorResponse('仓位不存在', 404)

  // 检查编码唯一性（如果编码变更）
  if (body.code && (body.code !== existing.code || (body.zoneId && body.zoneId !== existing.zoneId))) {
    const dup = await prisma.warehouseLocation.findUnique({
      where: { zoneId_code: { zoneId: body.zoneId || existing.zoneId, code: body.code } },
    })
    if (dup && dup.id !== body.id) {
      return errorResponse(`区域内已存在编码「${body.code}」`, 400)
    }
  }

  const updated = await prisma.warehouseLocation.update({
    where: { id: body.id },
    data: {
      zoneId: body.zoneId ?? undefined,
      code: body.code ?? undefined,
      description: body.description !== undefined ? body.description : undefined,
      isOccupied: body.isOccupied !== undefined ? body.isOccupied : undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
    include: {
      zone: { select: { id: true, name: true } },
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'WarehouseLocation',
    entityId: body.id,
    detail: { code: existing.code },
    ip,
  })

  return NextResponse.json(successResponse(updated))
}

// DELETE /api/logistics/warehouses/locations — 删除仓位
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_location.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return errorResponse('缺少仓位ID', 400)

  const ip = extractIp(req)

  const location = await prisma.warehouseLocation.findUnique({ where: { id } })
  if (!location) return errorResponse('仓位不存在', 404)

  await prisma.warehouseLocation.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'WarehouseLocation',
    entityId: id,
    detail: { code: location.code },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
