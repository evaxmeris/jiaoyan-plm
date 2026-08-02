// 产品开发里程碑 API — 支持 CRUD 和批量更新
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// 里程碑预定义阶段（按顺序排列）
const MILESTONE_STAGES: { stage: string; label: string }[] = [
  { stage: 'CONCEPT_REVIEW', label: '概念评审' },
  { stage: 'FORMULA_FINALIZED', label: '配方定版' },
  { stage: 'PACKAGING_CONFIRMED', label: '包材确认' },
  { stage: 'SAMPLE_CONFIRMED', label: '样品确认' },
  { stage: 'EFFICACY_COMPLETED', label: '功效完成' },
  { stage: 'REGISTRATION_COMPLETED', label: '备案完成' },
  { stage: 'PILOT_COMPLETED', label: '试产完成' },
  { stage: 'COMPLIANCE_READY', label: '合规就绪' },
  { stage: 'PRODUCTION_READY', label: '生产就绪' },
]

interface MilestoneItem {
  id?: string
  stage: string
  label: string
  completed: boolean
  completedAt: Date | string | null
  completedBy: string | null
  remark: string | null
  createdAt?: Date
  updatedAt?: Date
}

// GET /api/rnd/products/[id]/milestones — 获取产品的开发里程碑
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'product.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const milestones = await prisma.productMilestone.findMany({
    where: { productDesignId: id },
    orderBy: { createdAt: 'asc' },
  })

  // 如果还没有里程碑记录，返回预定义的阶段列表
  if (milestones.length === 0) {
    return NextResponse.json(successResponse({
      milestones: MILESTONE_STAGES.map((m) => ({
        stage: m.stage,
        label: m.label,
        completed: false,
        completedAt: null,
        completedBy: null,
        remark: null,
      })),
      predefined: true,
    }))
  }

  // 合并预定义阶段和实际里程碑（补充未创建的里程碑）
  const stageMap = new Map<string, typeof milestones[0]>(milestones.map((m) => [m.stage, m]))
  const merged: MilestoneItem[] = MILESTONE_STAGES.map((m: { stage: string; label: string }) => {
    const existing = stageMap.get(m.stage)
    return existing
      ? { ...existing, label: existing.label || m.label }
      : { stage: m.stage, label: m.label, completed: false, completedAt: null, completedBy: null, remark: null }
  })

  return NextResponse.json(successResponse({ milestones: merged, predefined: false }))
}

// POST /api/rnd/products/[id]/milestones — 创建或更新里程碑
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'product.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 验证产品存在
  const product = await prisma.productDesign.findUnique({ where: { id } })
  if (!product) return errorResponse('产品不存在', 404)

  // 支持单个里程碑更新或批量更新
  if (body.batch && Array.isArray(body.milestones)) {
    // 批量更新：删除旧的里程碑，重新创建
    await prisma.productMilestone.deleteMany({ where: { productDesignId: id } })

    const created = []
    for (const m of body.milestones) {
      const milestone = await prisma.productMilestone.create({
        data: {
          productDesignId: id,
          stage: m.stage,
          label: m.label || MILESTONE_STAGES.find((s) => s.stage === m.stage)?.label || m.stage,
          completed: m.completed ?? false,
          completedAt: m.completed && m.completedAt ? new Date(m.completedAt) : (m.completed ? new Date() : null),
          completedBy: m.completed ? (m.completedBy || user.name) : null,
          remark: m.remark || null,
        },
      })
      created.push(milestone)
    }

    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'MILESTONE_BATCH_UPDATE',
      entity: 'ProductMilestone',
      entityId: id,
      detail: { productDesignId: id, batch: true, count: created.length },
      ip,
    })

    return NextResponse.json(successResponse({ milestones: created }))
  }

  // 单个里程碑创建/更新（通过 stage 唯一约束 upsert）
  const milestone = await prisma.productMilestone.upsert({
    where: {
      productDesignId_stage: {
        productDesignId: id,
        stage: body.stage,
      },
    },
    update: {
      label: body.label ?? undefined,
      completed: body.completed ?? undefined,
      completedAt: body.completed
        ? (body.completedAt ? new Date(body.completedAt) : new Date())
        : null,
      completedBy: body.completed ? (body.completedBy || user.name) : null,
      remark: body.remark ?? undefined,
    },
    create: {
      productDesignId: id,
      stage: body.stage,
      label: body.label || MILESTONE_STAGES.find((s) => s.stage === body.stage)?.label || body.stage,
      completed: body.completed ?? false,
      completedAt: body.completed && body.completedAt ? new Date(body.completedAt) : (body.completed ? new Date() : null),
      completedBy: body.completed ? (body.completedBy || user.name) : null,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'MILESTONE_UPSERT',
    entity: 'ProductMilestone',
    entityId: milestone.id,
    detail: { productDesignId: id, stage: milestone.stage, completed: milestone.completed },
    ip,
  })

  return NextResponse.json(successResponse({ milestone }))
}

// DELETE /api/rnd/products/[id]/milestones — 删除里程碑（通过 query param stage）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  if (!stage) return errorResponse('缺少 stage 参数', 400)

  const existing = await prisma.productMilestone.findUnique({
    where: { productDesignId_stage: { productDesignId: id, stage } },
  })
  if (!existing) return errorResponse('里程碑不存在', 404)

  const ip = extractIp(req)
  await prisma.productMilestone.delete({
    where: { productDesignId_stage: { productDesignId: id, stage } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ProductMilestone',
    entityId: existing.id,
    detail: { productDesignId: id, stage },
    ip,
  })

  return NextResponse.json(successResponse(null))
}
