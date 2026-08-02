import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { RegisterSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/users — 用户列表（仅 CEO）
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      isActive: true,
      status: true,
      approvedBy: true,
      approvedAt: true,
      rejectReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ users }))
}

// POST /api/users — 创建用户（仅 CEO）
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const validated = await validateBody(req, RegisterSchema.passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const { email, password, name, role, department } = body

  // 检查邮箱是否已存在
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return errorResponse('该邮箱已被注册', 409)
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: role || 'DEVELOPER',
      department: department || null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
    },
  })

  const ip = extractIp(req)
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'User',
    entityId: newUser.id,
    detail: { email: newUser.email, name: newUser.name, role: newUser.role },
    ip,
  })

  return NextResponse.json(successResponse({ user: newUser }), { status: 201 })
}
