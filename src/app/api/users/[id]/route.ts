import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// PUT /api/users/[id] — 更新用户角色/状态（仅 CEO）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { role, isActive, name, department } = body

  // 不允许 CEO 修改自己
  if (id === user.id) {
    return errorResponse('不能修改自己的角色或状态', 400)
  }

  const oldUser = await prisma.user.findUnique({ where: { id } })
  if (!oldUser) {
    return errorResponse('用户不存在', 404)
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(name !== undefined && { name }),
      ...(department !== undefined && { department }),
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
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    detail: { email: updated.email, role: updated.role, isActive: updated.isActive },
    ip,
  })

  return NextResponse.json(successResponse({ user: updated }))
}

// DELETE /api/users/[id] — 软删除用户（仅 CEO；保留业务数据，标记 deletedAt 并从列表/登录中移除）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  // 不允许删除自己
  if (id === user.id) {
    return errorResponse('不能删除自己的账号', 400)
  }

  const oldUser = await prisma.user.findUnique({ where: { id } })
  if (!oldUser || oldUser.deletedAt) {
    return errorResponse('用户不存在', 404)
  }

  // 软删除：标记 deletedAt + 停用；历史业务数据（采购/报销/审批/合同）全部保留
  const updated = await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      deletedAt: true,
    },
  })

  const ip = extractIp(req)
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'User',
    entityId: id,
    detail: { email: updated.email, name: updated.name, role: updated.role, method: 'soft-delete' },
    ip,
  })

  return NextResponse.json(successResponse({ user: updated, message: '用户已删除' }))
}
