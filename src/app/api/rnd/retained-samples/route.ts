// 留样记录 CRUD API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/retained-samples — 获取留样记录列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'retained_sample.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const where: any = { isDeleted: false }
  if (productId) where.productDesignId = productId

  const samples = await prisma.retainedSample.findMany({
    where,
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ samples }))
}

// POST /api/rnd/retained-samples — 创建留样记录
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'retained_sample.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  const product = await prisma.productDesign.findUnique({ where: { id: body.productDesignId } })
  if (!product) return errorResponse('产品不存在', 404)

  const sample = await prisma.retainedSample.create({
    data: {
      productDesignId: body.productDesignId,
      batchNo: body.batchNo,
      quantity: parseInt(body.quantity) || 0,
      storageLocation: body.storageLocation || null,
      sampleDate: body.sampleDate ? new Date(body.sampleDate) : new Date(),
      expireDate: body.expireDate ? new Date(body.expireDate) : null,
      status: body.status || 'NORMAL',
      observationRecords: body.observationRecords || null,
      remark: body.remark || null,
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'RetainedSample',
    entityId: sample.id,
    detail: { productDesignId: body.productDesignId, batchNo: sample.batchNo },
    ip,
  })

  return NextResponse.json(successResponse({ sample }), { status: 201 })
}
