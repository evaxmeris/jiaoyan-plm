import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { errorResponse } from '@/lib/api-response'

// PUT /api/compliance/registrations/[id]/documents/[did] — 更新材料信息（含状态变更）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; did: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration_document.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id, did } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 确认备案存在
  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    select: { id: true },
  })
  if (!registration) return errorResponse('备案记录不存在', 404)

  // 确认材料存在
  const existing = await prisma.registrationDocument.findUnique({
    where: { id: did },
  })
  if (!existing || existing.registrationId !== id) {
    return errorResponse('材料记录不存在', 404)
  }

  // 状态流转校验
  if (body.status) {
    const validTransitions: Record<string, string[]> = {
      PENDING: ['SUBMITTED'],
      SUBMITTED: ['RETURNED'],
      RETURNED: ['SUBMITTED', 'PENDING'],
    }
    const allowed = validTransitions[existing.status]
    if (!allowed || !allowed.includes(body.status)) {
      return errorResponse(`材料状态不能从「${existing.status}」变更为「${body.status}」`, 400)
    }
  }

  const doc = await prisma.registrationDocument.update({
    where: { id: did },
    data: {
      name: body.name !== undefined ? body.name.trim() : undefined,
      required: body.required !== undefined ? Boolean(body.required) : undefined,
      status: body.status || undefined,
      submitDate: body.submitDate !== undefined
        ? (body.submitDate ? new Date(body.submitDate) : null)
        : undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'RegistrationDocument',
    entityId: did,
    detail: {
      registrationId: id,
      oldStatus: existing.status,
      newStatus: body.status || existing.status,
      name: doc.name,
    },
    ip,
  })

  return NextResponse.json({ success: true, data: { document: doc } })
}

// DELETE /api/compliance/registrations/[id]/documents/[did] — 删除材料
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; did: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration_document.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id, did } = await params
  const ip = extractIp(req)

  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    select: { id: true },
  })
  if (!registration) return errorResponse('备案记录不存在', 404)

  const existing = await prisma.registrationDocument.findUnique({ where: { id: did } })
  if (!existing || existing.registrationId !== id) {
    return errorResponse('材料记录不存在', 404)
  }

  await prisma.registrationDocument.delete({ where: { id: did } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'RegistrationDocument',
    entityId: did,
    detail: { registrationId: id, name: existing.name, status: existing.status },
    ip,
  })

  return NextResponse.json({ success: true, data: { ok: true } })
}
