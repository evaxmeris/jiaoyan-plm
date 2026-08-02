import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { SafetyAssessmentSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/compliance/registrations/[id]/assessments — 获取安全评估报告列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'assessment.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  // 验证备案存在
  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    select: { id: true },
  })
  if (!registration) return errorResponse('备案记录不存在', 404)

  const assessments = await prisma.safetyAssessment.findMany({
    where: { registrationId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ assessments }))
}

// POST /api/compliance/registrations/[id]/assessments — 创建安全评估报告
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'assessment.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  // 验证备案存在
  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    select: { id: true },
  })
  if (!registration) return errorResponse('备案记录不存在', 404)

  const validated = await validateBody(req, SafetyAssessmentSchema)
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  const assessment = await prisma.safetyAssessment.create({
    data: {
      registrationId: id,
      assessor: body.assessor,
      assessDate: body.assessDate ? new Date(body.assessDate) : null,
      reportNo: body.reportNo || null,
      conclusion: body.conclusion,
      fileUrl: body.fileUrl || null,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'SafetyAssessment',
    entityId: assessment.id,
    detail: {
      registrationId: id,
      assessor: assessment.assessor,
      conclusion: assessment.conclusion,
      reportNo: assessment.reportNo,
    },
    ip,
  })

  return NextResponse.json(successResponse({ assessment }), { status: 201 })
}
