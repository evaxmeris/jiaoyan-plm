import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { LoginSchema, validateBody } from '@/lib/validation'
import { loginLimiter } from '@/lib/rate-limit'
import { successResponse } from '@/lib/api-response'
import { AppError, withErrorHandler } from '@/lib/api-error'

export const POST = withErrorHandler(async (request: Request) => {
  // ── 限速检查 ──
  const ip = extractIp(request)
  const limitResult = loginLimiter.check(`login:${ip}`)
  if (!limitResult.allowed) {
    throw new AppError(limitResult.error || '请求过于频繁', 429)
  }

  // ── 输入校验 ──
  const validated = await validateBody(request, LoginSchema)
  if (!validated.success) return validated.response

  const { email, password } = validated.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    await writeAuditLog({
      action: 'LOGIN',
      entity: 'User',
      detail: { email, success: false, reason: '用户不存在或已禁用' },
      ip,
    })
    throw new AppError('邮箱或密码错误', 401)
  }

  // 已注销账号（软删除）拦截
  if (user.deletedAt) {
    await writeAuditLog({
      action: 'LOGIN',
      entity: 'User',
      detail: { email, success: false, reason: '账号已注销' },
      ip,
    })
    throw new AppError('账号已注销，请联系管理员', 403)
  }

  // 检查用户审批状态
  if (user.status === 'PENDING_APPROVAL') {
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'User',
      detail: { email, success: false, reason: '账号待审核' },
      ip,
    })
    throw new AppError('账号待审核，请等待管理员审批', 403)
  }

  if (user.status === 'DISABLED') {
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'User',
      detail: { email, success: false, reason: '账号已被禁用' },
      ip,
    })
    throw new AppError('账号已被禁用', 403)
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'User',
      detail: { email, success: false, reason: '密码错误' },
      ip,
    })
    throw new AppError('邮箱或密码错误', 401)
  }

  const token = signToken(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
  )

  // 记录登录成功
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'LOGIN',
    entity: 'User',
    detail: { email, role: user.role, success: true },
    ip,
  })

  const response = NextResponse.json(successResponse({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
    token, // 返回 token 供前端 localStorage 备用
  }))

  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  })

  return response
})
