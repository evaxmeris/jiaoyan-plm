// 批量里程碑查询 API — 一次查询多个实体的里程碑节点
// POST /api/milestones/batch — body: { entityType, entityIds: string[] }
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'milestone.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { entityType, entityIds } = body

  if (!entityType || !entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
    return errorResponse('缺少必要参数: entityType, entityIds (string[])', 400)
  }

  const milestones = await prisma.processMilestone.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
    },
    orderBy: { sortOrder: 'asc' },
  })

  // 按 entityId 分组返回
  const grouped: Record<string, any[]> = {}
  for (const m of milestones) {
    if (!grouped[m.entityId]) grouped[m.entityId] = []
    grouped[m.entityId].push(m)
  }

  return NextResponse.json(successResponse({ milestones: grouped }))
}
