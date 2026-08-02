import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/supply/suppliers/[id]/evaluations — 获取评价记录列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'supplier.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const evaluations = await prisma.supplierEvaluation.findMany({
    where: { supplierId: id },
    orderBy: { evalDate: 'desc' },
  })
  return NextResponse.json(successResponse(evaluations))
}

// POST /api/supply/suppliers/[id]/evaluations — 创建评价记录
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  if (!await verifyPermission(user.role, 'supplier.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const scoreQuality = parseFloat(body.scoreQuality) || 0
  const scoreDelivery = parseFloat(body.scoreDelivery) || 0
  const scoreService = parseFloat(body.scoreService) || 0

  // 加权总分：质量40% + 交期35% + 服务25% （可配置）
  const qualityWeight = body.qualityWeight !== undefined ? parseFloat(body.qualityWeight) : 0.4
  const deliveryWeight = body.deliveryWeight !== undefined ? parseFloat(body.deliveryWeight) : 0.35
  const serviceWeight = body.serviceWeight !== undefined ? parseFloat(body.serviceWeight) : 0.25
  const weightedTotal = scoreQuality * qualityWeight + scoreDelivery * deliveryWeight + scoreService * serviceWeight
  const scoreTotal = body.scoreTotal !== undefined ? parseFloat(body.scoreTotal) : Math.round(weightedTotal * 100) / 100

  // 自动定级（A=优秀 B=良好 C=合格 D=不合格）
  let grade = 'C'
  if (scoreTotal >= 90) grade = 'A'
  else if (scoreTotal >= 75) grade = 'B'
  else if (scoreTotal >= 60) grade = 'C'
  else grade = 'D'

  const evaluation = await prisma.supplierEvaluation.create({
    data: {
      supplierId: id,
      evalDate: new Date(body.evalDate),
      scoreQuality,
      scoreDelivery,
      scoreService,
      scoreTotal,
      grade,
      evaluator: body.evaluator,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'SupplierEvaluation',
    entityId: evaluation.id,
    detail: { supplierId: id, scoreTotal: evaluation.scoreTotal, evaluator: evaluation.evaluator },
    ip,
  })

  return NextResponse.json(successResponse(evaluation), { status: 201 })
}
