import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { RegisterSchema, validateBody } from '@/lib/validation'
import { loginLimiter } from '@/lib/rate-limit'
import { successResponse } from '@/lib/api-response'
import { AppError, withErrorHandler } from '@/lib/api-error'

export const POST = withErrorHandler(async (request: Request) => {
  // ── 限速检查 ──
  const ip = extractIp(request)
  const limitResult = loginLimiter.check(`register:${ip}`)
  if (!limitResult.allowed) {
    throw new AppError(limitResult.error || '请求过于频繁', 429)
  }

  // ── 输入校验 ──
  const validated = await validateBody(request, RegisterSchema)
  if (!validated.success) return validated.response

  const { email, name, password, department } = validated.data

  // 邮箱格式校验
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new AppError('邮箱格式不正确', 400)
  }

  // 检查邮箱是否已注册
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    await writeAuditLog({
      action: 'CREATE',
      entity: 'User',
      detail: { email, success: false, reason: '邮箱已注册' },
      ip,
    })
    throw new AppError('该邮箱已注册', 409)
  }

  // bcrypt 加密密码
  const passwordHash = await bcrypt.hash(password, 12)

  // 创建用户（角色：OBSERVER，状态：PENDING_APPROVAL）
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'OBSERVER',
      department: department || null,
      isActive: true,
      status: 'PENDING_APPROVAL',
    },
  })

  // 记录审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'User',
    entityId: user.id,
    detail: { email, name, role: 'OBSERVER', department: department || null, method: 'register', status: 'PENDING_APPROVAL' },
    ip,
  })

  return NextResponse.json(successResponse({
    message: '注册成功，请等待管理员审核',
  }))
})
