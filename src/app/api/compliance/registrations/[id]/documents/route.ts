import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { errorResponse } from '@/lib/api-response'

// GET /api/compliance/registrations/[id]/documents — 获取材料清单
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration.detail', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    select: { id: true },
  })
  if (!registration) return errorResponse('备案记录不存在', 404)

  const documents = await prisma.registrationDocument.findMany({
    where: { registrationId: id },
    orderBy: [{ required: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ success: true, data: { documents } })
}

// POST /api/compliance/registrations/[id]/documents — 新增材料
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration_document.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 验证必填字段
  if (!body.name || !body.name.trim()) {
    return errorResponse('材料名称不能为空')
  }

  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    select: { id: true },
  })
  if (!registration) return errorResponse('备案记录不存在', 404)

  // 参数校验
  const validStatuses = ['PENDING', 'SUBMITTED', 'RETURNED']
  const status = body.status && validStatuses.includes(body.status) ? body.status : 'PENDING'

  const doc = await prisma.registrationDocument.create({
    data: {
      registrationId: id,
      name: body.name.trim(),
      required: body.required !== undefined ? Boolean(body.required) : true,
      status,
      submitDate: body.submitDate ? new Date(body.submitDate) : null,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'RegistrationDocument',
    entityId: doc.id,
    detail: { registrationId: id, name: doc.name, status: doc.status },
    ip,
  })

  return NextResponse.json({ success: true, data: { document: doc } }, { status: 201 })
}
