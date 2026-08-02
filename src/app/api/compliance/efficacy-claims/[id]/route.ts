import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { EfficacyClaimSchema } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'efficacy_claim.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const claim = await prisma.efficacyClaim.findUnique({
    where: { id },
    include: { product: { select: { name: true } } },
  })

  if (!claim) return errorResponse('功效宣称记录不存在', 404)

  return NextResponse.json(successResponse({ efficacyClaim: claim }))
}

// PUT /api/compliance/efficacy-claims/[id] — 更新状态或全部字段
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'efficacy_claim.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.efficacyClaim.findUnique({ where: { id } })
  if (!existing) return errorResponse('功效宣称记录不存在', 404)

  let body: any
  try { body = await req.json() } catch { body = {} }

  // 校验：如果传了完整字段则全量校验，否则只校验传入的字段（部分更新）
  const data: any = {}
  if (body.claimName !== undefined) data.claimName = body.claimName
  if (body.category !== undefined) {
    if (!['STANDARD', 'NEW'].includes(body.category)) return errorResponse('无效的宣称类别')
    data.category = body.category
  }
  if (body.status !== undefined) {
    if (!['DRAFT', 'REVIEWING', 'APPROVED', 'REJECTED'].includes(body.status)) return errorResponse('无效的状态')
    data.status = body.status
  }
  if (body.productDesignId !== undefined) data.productDesignId = body.productDesignId || null
  if (body.evidence !== undefined) data.evidence = body.evidence || null
  if (body.testEntrustmentId !== undefined) data.testEntrustmentId = body.testEntrustmentId || null
  if (body.remark !== undefined) data.remark = body.remark || null

  const claim = await prisma.efficacyClaim.update({
    where: { id },
    data,
    include: { product: { select: { name: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status && body.status !== existing.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'EfficacyClaim',
    entityId: id,
    detail: {
      oldStatus: existing.status,
      newStatus: claim.status,
      claimName: claim.claimName,
    },
    ip,
  })

  return NextResponse.json(successResponse({ efficacyClaim: claim }))
}

// DELETE /api/compliance/efficacy-claims/[id] — 硬删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'efficacy_claim.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.efficacyClaim.findUnique({ where: { id } })
  if (!existing) return errorResponse('功效宣称记录不存在', 404)

  await prisma.efficacyClaim.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'EfficacyClaim',
    entityId: id,
    detail: { claimName: existing.claimName },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
