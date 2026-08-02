// 试产/中试 API — 产品试产记录列表（GET/POST）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// 生成批次号 PLT-年份-序列号
async function generateBatchNo(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PLT-${year}-`
  const last = await prisma.pilotRun.findFirst({
    where: { batchNo: { startsWith: prefix } },
    orderBy: { batchNo: 'desc' },
    select: { batchNo: true },
  })
  let nextSeq = 1
  if (last) {
    const parts = last.batchNo.split('-')
    nextSeq = parseInt(parts[parts.length - 1], 10) + 1
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

// GET /api/rnd/products/[id]/pilot-runs — 获取产品的所有试产记录
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'pilot_run.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const pilotRuns = await prisma.pilotRun.findMany({
    where: { productDesignId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ pilotRuns }))
}

// POST /api/rnd/products/[id]/pilot-runs — 新建试产记录
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'pilot_run.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 验证产品存在
  const product = await prisma.productDesign.findUnique({ where: { id } })
  if (!product) return errorResponse('产品不存在', 404)

  // 必填字段校验
  if (!body.scale) return errorResponse('请填写试产规模', 400)
  if (!body.producer) return errorResponse('请填写生产方', 400)

  const batchNo = await generateBatchNo()

  const pilotRun = await prisma.pilotRun.create({
    data: {
      productDesignId: id,
      batchNo,
      scale: body.scale,
      producer: body.producer,
      plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
      completedDate: body.completedDate ? new Date(body.completedDate) : null,
      status: body.status || 'PLANNED',
      result: body.result || null,
      yield: body.yield ? parseFloat(body.yield) : null,
      defects: body.defects || null,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PilotRun',
    entityId: pilotRun.id,
    detail: { productDesignId: id, batchNo, scale: pilotRun.scale, producer: pilotRun.producer },
    ip,
  })

  return NextResponse.json(successResponse({ pilotRun }), { status: 201 })
}
