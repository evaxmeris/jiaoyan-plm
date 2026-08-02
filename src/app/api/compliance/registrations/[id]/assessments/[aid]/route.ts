import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { SafetyAssessmentSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/compliance/registrations/[id]/assessments/[aid] — 获取单条安全评估报告
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'assessment.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id, aid } = await params

  const assessment = await prisma.safetyAssessment.findUnique({
    where: { id: aid, registrationId: id },
  })

  if (!assessment) return errorResponse('安全评估报告不存在', 404)

  return NextResponse.json(successResponse({ assessment }))
}

// PUT /api/compliance/registrations/[id]/assessments/[aid] — 更新安全评估报告
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'assessment.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id, aid } = await params
  const validated = await validateBody(req, SafetyAssessmentSchema.partial().passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  const existing = await prisma.safetyAssessment.findUnique({
    where: { id: aid, registrationId: id },
  })
  if (!existing) return errorResponse('安全评估报告不存在', 404)

  const assessment = await prisma.safetyAssessment.update({
    where: { id: aid },
    data: {
      assessor: body.assessor ?? undefined,
      assessDate: body.assessDate ? new Date(body.assessDate) : undefined,
      reportNo: body.reportNo ?? undefined,
      conclusion: body.conclusion ?? undefined,
      fileUrl: body.fileUrl ?? undefined,
      remark: body.remark ?? undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'SafetyAssessment',
    entityId: aid,
    detail: {
      registrationId: id,
      oldConclusion: existing.conclusion,
      newConclusion: assessment.conclusion,
    },
    ip,
  })

  return NextResponse.json(successResponse({ assessment }))
}

// DELETE /api/compliance/registrations/[id]/assessments/[aid] — 删除安全评估报告
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'assessment.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id, aid } = await params
  const ip = extractIp(req)

  const existing = await prisma.safetyAssessment.findUnique({
    where: { id: aid, registrationId: id },
  })
  if (!existing) return errorResponse('安全评估报告不存在', 404)

  await prisma.safetyAssessment.delete({
    where: { id: aid },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'SafetyAssessment',
    entityId: aid,
    detail: {
      registrationId: id,
      assessor: existing.assessor,
      conclusion: existing.conclusion,
    },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
