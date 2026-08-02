import { NextResponse } from 'next/server'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET: 返回当前用户的完整信息
export async function GET() {
  try {
    const user = await verifyAuth()
    if (!user) {
      return errorResponse('未登录', 401)
    }
    if (!await verifyPermission(user.role, 'profile.view', user.id)) {
      return errorResponse('权限不足', 403)
    }

    return NextResponse.json(successResponse({ user }))
  } catch (error) {
    console.error('Profile GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

// PUT: 更新用户信息（姓名）
export async function PUT(request: Request) {
  try {
    const currentUser = await verifyAuth()
    if (!currentUser) {
      return errorResponse('未登录', 401)
    }
    if (!await verifyPermission(currentUser.role, 'profile.update', currentUser.id)) {
      return errorResponse('权限不足', 403)
    }

    const { name } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('请输入姓名', 400)
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, role: true, department: true },
    })

    return NextResponse.json(successResponse({ user: updatedUser }))
  } catch (error) {
    console.error('Profile PUT error:', error)
    return errorResponse('服务器错误', 500)
  }
}
