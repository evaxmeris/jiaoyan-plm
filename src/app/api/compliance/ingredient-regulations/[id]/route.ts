import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// PUT /api/compliance/ingredient-regulations/[id] — 更新法规条目
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const existing = await prisma.ingredientRegulation.findUnique({ where: { id } })
  if (!existing) return errorResponse('法规条目不存在', 404)

  if (body.regulationType && !['PROHIBITED', 'RESTRICTED', 'ALLOWED'].includes(body.regulationType)) {
    return errorResponse('regulationType 必须为 PROHIBITED / RESTRICTED / ALLOWED', 400)
  }

  const record = await prisma.ingredientRegulation.update({
    where: { id },
    data: {
      nameCn: body.nameCn ?? undefined,
      nameEn: body.nameEn ?? undefined,
      inciName: body.inciName ?? undefined,
      casNo: body.casNo ?? undefined,
      regulationType: body.regulationType ?? undefined,
      market: body.market ?? undefined,
      maxConcentration: body.maxConcentration !== undefined ? body.maxConcentration : undefined,
      productTypeRestriction: body.productTypeRestriction ?? undefined,
      restrictionNote: body.restrictionNote ?? undefined,
      sourceRegulation: body.sourceRegulation ?? undefined,
      category: body.category ?? undefined,
      scope: body.scope ?? undefined,
      ingredientFunction: body.ingredientFunction ?? undefined,
      referenceFile: body.referenceFile ?? undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ingredientRegulation',
    entityId: id,
    detail: { nameCn: record.nameCn, regulationType: record.regulationType, market: record.market },
    ip,
  })

  return NextResponse.json(successResponse({ ingredientRegulation: record }))
}

// DELETE /api/compliance/ingredient-regulations/[id] — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.ingredientRegulation.findUnique({ where: { id } })
  if (!existing || !existing.isActive) {
    return errorResponse('法规条目不存在', 404)
  }

  await prisma.ingredientRegulation.update({
    where: { id },
    data: { isActive: false },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ingredientRegulation',
    entityId: id,
    detail: { nameCn: existing.nameCn, regulationType: existing.regulationType },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
