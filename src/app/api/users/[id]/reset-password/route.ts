import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { successResponse } from '@/lib/api-response'
import { AppError, withErrorHandler } from '@/lib/api-error'

// POST /api/users/[id]/reset-password — 管理员重置指定用户密码（仅 CEO）
export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const operator = await verifyAuth()
  if (!operator) throw new AppError('未登录', 401)
  if (!await verifyPermission(operator.role, 'user.update', operator.id)) {
    throw new AppError('权限不足', 403)
  }

  const { id } = await params

  // 不允许重置自己的密码（个人改密走 /api/profile/password）
  if (id === operator.id) {
    throw new AppError('不能重置自己的密码，请到个人中心修改', 400)
  }

  const body = await req.json()
  const { newPassword } = body

  if (!newPassword || typeof newPassword !== 'string') {
    throw new AppError('请输入新密码', 400)
  }
  if (newPassword.length < 6) {
    throw new AppError('新密码长度不能少于6位', 400)
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.deletedAt) {
    throw new AppError('用户不存在', 404)
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  })

  const ip = extractIp(req)
  await writeAuditLog({
    userId: operator.id,
    userName: operator.name,
    action: 'RESET_PASSWORD',
    entity: 'User',
    entityId: id,
    detail: { email: target.email, operator: operator.email },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true, message: '密码重置成功' }))
})
