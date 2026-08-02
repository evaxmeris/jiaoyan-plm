// 通用业务流程里程碑 — 单个节点操作（删除）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// DELETE /api/milestones/[id] — 删除里程碑节点
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'milestone.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const existing = await prisma.processMilestone.findUnique({ where: { id } })
  if (!existing) return errorResponse('里程碑节点不存在', 404)

  const ip = extractIp(req)
  await prisma.processMilestone.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: existing.entityType,
    entityId: existing.id,
    detail: { entityType: existing.entityType, entityId: existing.entityId, stage: existing.stage },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
