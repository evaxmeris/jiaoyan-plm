import { NextResponse } from 'next/server'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// PUT: 修改密码
export async function PUT(request: Request) {
  try {
    const currentUser = await verifyAuth()
    if (!currentUser) {
      return errorResponse('未登录', 401)
    }
    if (!await verifyPermission(currentUser.role, 'profile.update', currentUser.id)) {
      return errorResponse('权限不足', 403)
    }

    const { oldPassword, newPassword } = await request.json()

    // 参数校验
    if (!oldPassword || !newPassword) {
      return errorResponse('请填写旧密码和新密码', 400)
    }

    if (newPassword.length < 6) {
      return errorResponse('新密码长度不能少于6位', 400)
    }

    if (oldPassword === newPassword) {
      return errorResponse('新密码不能与旧密码相同', 400)
    }

    // 获取用户完整信息（含密码哈希）
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true },
    })

    if (!user) {
      return errorResponse('用户不存在', 404)
    }

    // 验证旧密码
    const valid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!valid) {
      return errorResponse('旧密码错误', 403)
    }

    // 加密新密码并保存
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash },
    })

    // 改密审计（个人改密同样留痕，保证安全审计完整）
    await writeAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: currentUser.id,
      detail: { email: currentUser.email, via: 'profile' },
      ip: extractIp(request),
    })

    return NextResponse.json(successResponse({ ok: true, message: '密码修改成功' }))
  } catch (error) {
    console.error('Profile password PUT error:', error)
    return errorResponse('服务器错误', 500)
  }
}
