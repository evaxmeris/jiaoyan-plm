import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse } from '@/lib/api-response'
import { AppError, withErrorHandler } from '@/lib/api-error'

export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. 优先从 cookie 读取 token
  let token = request.cookies.get('token')?.value

  // 2. 如果 cookie 没有，从 Authorization header 读取（localStorage 备用）
  if (!token) {
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
  }

  if (!token) throw new AppError('未登录', 401)

  const payload = verifyToken(token)
  if (!payload) throw new AppError('登录已过期', 401)

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, department: true, isActive: true },
  })

  if (!user || !user.isActive) throw new AppError('用户不存在或已禁用', 401)

  return NextResponse.json(successResponse({
    user,
    token, // 返回 token 供前端 localStorage 刷新
  }))
})
