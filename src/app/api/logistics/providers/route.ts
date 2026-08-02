// 物流商 CRUD API — 使用通用 CRUD 工厂
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'
import { createCrudHandlers } from '@/lib/crud-factory'

const { GET: factoryGet, POST: factoryPost } = createCrudHandlers({
  model: 'logisticsProvider',
  permissions: { view: 'logistics_provider.view', create: 'logistics_provider.create', update: 'logistics_provider.update', delete: 'logistics_provider.delete' },
  orderBy: { createdAt: 'desc' },
  searchFields: ['name'],
})

// GET /api/logistics/providers — 使用工厂
export const GET = factoryGet

// POST /api/logistics/providers — 使用工厂
export const POST = factoryPost

// PUT /api/logistics/providers — 更新物流商（通过 body.id）
export async function PUT(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'logistics_provider.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.id) {
    return errorResponse('缺少物流商ID', 400)
  }

  const existing = await prisma.logisticsProvider.findUnique({ where: { id: body.id } })
  if (!existing) return errorResponse('物流商不存在', 404)

  const updated = await prisma.logisticsProvider.update({
    where: { id: body.id },
    data: {
      name: body.name ?? undefined,
      contact: body.contact !== undefined ? body.contact : undefined,
      phone: body.phone !== undefined ? body.phone : undefined,
      regions: body.regions !== undefined ? body.regions : undefined,
      isActive: body.isActive !== undefined ? body.isActive : undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'LogisticsProvider',
    entityId: body.id,
    detail: { name: existing.name },
    ip,
  })

  return NextResponse.json(successResponse(updated))
}

// DELETE /api/logistics/providers — 删除物流商（通过 query id 或 body.id）
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'logistics_provider.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  let id = searchParams.get('id')
  if (!id) {
    let body: any
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    id = body.id
  }
  if (!id) return errorResponse('缺少物流商ID', 400)

  const ip = extractIp(req)

  const provider = await prisma.logisticsProvider.findUnique({ where: { id } })
  if (!provider) return errorResponse('物流商不存在', 404)

  await prisma.logisticsProvider.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'LogisticsProvider',
    entityId: id,
    detail: { name: provider.name },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
