// 通用业务流程里程碑 API — 支持多实体类型（Trademark/Patent/ServiceContract/ProductDesign）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// POST /api/milestones — 创建/更新里程碑节点（upsert by entityType+entityId+stage）
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'milestone.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)
  const { entityType, entityId, stage, label, status, completedAt, remark, fileUrls, sortOrder } = body

  if (!entityType || !entityId || !stage) {
    return errorResponse('缺少必要参数: entityType, entityId, stage', 400)
  }

  // 支持批量更新
  if (body.batch && Array.isArray(body.milestones)) {
    // 删除旧的，重新创建
    await prisma.processMilestone.deleteMany({
      where: { entityType, entityId },
    })

    const created = []
    for (const m of body.milestones) {
      const milestone = await prisma.processMilestone.create({
        data: {
          entityType,
          entityId,
          stage: m.stage,
          label: m.label || m.stage,
          status: m.status || 'PENDING',
          completedAt: m.status === 'COMPLETED' && m.completedAt ? new Date(m.completedAt) : (m.status === 'COMPLETED' ? new Date() : null),
          remark: m.remark || null,
          fileUrls: m.fileUrls || null,
          sortOrder: m.sortOrder ?? 0,
        },
      })
      created.push(milestone)
    }

    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'MILESTONE_BATCH_UPDATE',
      entity: entityType,
      entityId,
      detail: { batch: true, count: created.length },
      ip,
    })

    return NextResponse.json(successResponse({ milestones: created }), { status: 201 })
  }

  // 单个里程碑 upsert
  const milestone = await prisma.processMilestone.upsert({
    where: {
      entityType_entityId_stage: {
        entityType,
        entityId,
        stage,
      },
    },
    update: {
      label: label ?? undefined,
      status: status ?? undefined,
      completedAt: status === 'COMPLETED'
        ? (completedAt ? new Date(completedAt) : new Date())
        : (status === 'PENDING' || status === 'SKIPPED' || status === 'FAILED' ? null : undefined),
      remark: remark ?? undefined,
      fileUrls: fileUrls ?? undefined,
      sortOrder: sortOrder ?? undefined,
    },
    create: {
      entityType,
      entityId,
      stage,
      label: label || stage,
      status: status || 'PENDING',
      completedAt: status === 'COMPLETED' && completedAt ? new Date(completedAt) : (status === 'COMPLETED' ? new Date() : null),
      remark: remark || null,
      fileUrls: fileUrls || null,
      sortOrder: sortOrder ?? 0,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'MILESTONE_UPSERT',
    entity: entityType,
    entityId: milestone.id,
    detail: { entityType, entityId, stage: milestone.stage, status: milestone.status },
    ip,
  })

  return NextResponse.json(successResponse({ milestone }))
}

// GET /api/milestones?entityType=X&entityId=Y — 获取某实体所有里程碑节点
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!entityType || !entityId) {
    return errorResponse('缺少查询参数: entityType, entityId', 400)
  }

  const milestones = await prisma.processMilestone.findMany({
    where: { entityType, entityId },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json(successResponse({ milestones }))
}
