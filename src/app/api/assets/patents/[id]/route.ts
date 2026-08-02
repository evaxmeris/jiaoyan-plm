import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/assets/patents/[id] — 获取专利详情（含关联）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const { id } = await params

  const patent = await prisma.patent.findFirst({
    where: { id, isDeleted: false },
    include: {
      fees: { orderBy: { year: 'desc' } },
    },
  })

  if (!patent) return errorResponse('专利不存在', 404)

  // 获取关联的审计日志
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: 'Patent', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(successResponse({ patent, auditLogs }))
}

// PUT /api/assets/patents/[id] — 更新专利（含扩展生命周期字段）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'patent.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const oldPatent = await prisma.patent.findUnique({ where: { id } })
  if (!oldPatent) return errorResponse('专利不存在', 404)

  // 构建可更新字段（只包含 body 中提供的字段）
  const data: Record<string, unknown> = {}
  const allowedFields = [
    'name', 'type', 'applicationNo', 'patentNo', 'inventor', 'applicant',
    'applyDate', 'grantDate', 'expireDate', 'status', 'techField', 'remark',
    'filingDate', 'publicationDate', 'agency', 'agentContact', 'fee',
    'filingReceipt', 'patentCert', 'officeActions',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // 日期字段转换
      if (['applyDate', 'grantDate', 'expireDate', 'filingDate', 'publicationDate'].includes(field)) {
        data[field] = body[field] ? new Date(body[field]) : null
      } else if (field === 'officeActions') {
        data[field] = body[field] // JSON 字段直接传
      } else {
        data[field] = body[field]
      }
    }
  }

  const patent = await prisma.patent.update({ where: { id }, data })

  const action = body.status && body.status !== oldPatent.status ? 'STATUS_CHANGE' : 'UPDATE'
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action,
    entity: 'Patent',
    entityId: id,
    detail: { oldStatus: oldPatent.status, newStatus: patent.status, name: patent.name },
    ip,
  })

  return NextResponse.json(successResponse({ patent }))
}

// DELETE /api/assets/patents/[id] — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'patent.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.patent.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return errorResponse('专利不存在', 404)
  }

  await prisma.patent.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'Patent',
    entityId: id,
    detail: { name: existing.name, applicationNo: existing.applicationNo },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
