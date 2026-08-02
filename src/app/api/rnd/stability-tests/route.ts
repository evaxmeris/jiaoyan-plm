// 稳定性跟踪 CRUD API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/stability-tests — 获取稳定性测试列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'stability.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const where: any = { isDeleted: false }
  if (productId) where.productDesignId = productId

  const tests = await prisma.stabilityTest.findMany({
    where,
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ tests }))
}

// POST /api/rnd/stability-tests — 创建稳定性测试
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'stability.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  const product = await prisma.productDesign.findUnique({ where: { id: body.productDesignId } })
  if (!product) return errorResponse('产品不存在', 404)

  const test = await prisma.stabilityTest.create({
    data: {
      productDesignId: body.productDesignId,
      batchNo: body.batchNo,
      testType: body.testType || 'ACCELERATED',
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : null,
      interval: parseInt(body.interval) || 1,
      status: body.status || 'IN_PROGRESS',
      records: body.records || null,
      remark: body.remark || null,
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'StabilityTest',
    entityId: test.id,
    detail: { productDesignId: body.productDesignId, batchNo: test.batchNo, testType: test.testType },
    ip,
  })

  return NextResponse.json(successResponse({ test }), { status: 201 })
}
