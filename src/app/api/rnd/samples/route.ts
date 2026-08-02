// 打样任务 CRUD API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { SampleTaskSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/samples — 获取打样任务列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'sample.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const where: any = { isDeleted: false }
  if (productId) where.productDesignId = productId

  const samples = await prisma.sampleTask.findMany({
    where,
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse(samples))
}

// POST /api/rnd/samples — 创建打样任务
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'sample.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const validated = await validateBody(req, SampleTaskSchema.passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  // 校验产品是否存在
  const product = await prisma.productDesign.findUnique({ where: { id: body.productDesignId } })
  if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  const sample = await prisma.sampleTask.create({
    data: {
      productDesignId: body.productDesignId,
      batchNo: body.batchNo || `JY-SP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
      quantity: parseInt(body.quantity) || 0,
      result: body.result || null,
      evaluation: body.evaluation || null,
      nextAction: body.nextAction || null,
      status: body.status || 'PENDING',
      assignedTo: body.assignedTo || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      remark: body.remark || null,
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })

  // 如果创建打样任务，自动更新产品状态为 SAMPLING
  if (product.status !== 'SAMPLING' && product.status !== 'TESTING') {
    await prisma.productDesign.update({
      where: { id: body.productDesignId },
      data: { status: 'SAMPLING' },
    })
  }

  // 审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'SampleTask',
    entityId: sample.id,
    detail: {
      productDesignId: body.productDesignId,
      batchNo: sample.batchNo,
      status: sample.status,
    },
    ip,
  })

  return NextResponse.json(successResponse(sample), { status: 201 })
}
