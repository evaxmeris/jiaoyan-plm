import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// PUT /api/users/[id]/approve — 审批通过用户注册
// PUT /api/users/[id]/approve?action=reject — 驳回用户注册
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // 查找目标用户
  const targetUser = await prisma.user.findUnique({ where: { id } })
  if (!targetUser || targetUser.deletedAt) {
    return errorResponse('用户不存在', 404)
  }

  if (targetUser.status !== 'PENDING_APPROVAL') {
    return errorResponse('该用户无需审批', 400)
  }

  const ip = extractIp(req)

  if (action === 'reject') {
    // 驳回
    const { rejectReason } = await req.json()
    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: 'DISABLED',
        isActive: false,
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectReason: rejectReason || '未提供原因',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        status: true,
        isActive: true,
        rejectReason: true,
        approvedBy: true,
        approvedAt: true,
      },
    })

    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      detail: { email: updated.email, action: 'reject', reason: rejectReason || '未提供原因' },
      ip,
    })

    return NextResponse.json(successResponse({ user: updated, message: '用户已驳回' }))
  }

  // 审批通过
  const { role } = await req.json()
  const updated = await prisma.user.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      approvedBy: user.id,
      approvedAt: new Date(),
      ...(role ? { role } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      status: true,
      isActive: true,
      approvedBy: true,
      approvedAt: true,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    detail: { email: updated.email, action: 'approve', role: role || updated.role },
    ip,
  })

  return NextResponse.json(successResponse({ user: updated, message: '用户已通过审批' }))
}
