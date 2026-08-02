// 成本核算 CRUD API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/costing — 获取成本核算列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'costing.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const where: any = {}
  if (productId) where.productDesignId = productId

  const costings = await prisma.productCosting.findMany({
    where,
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
    orderBy: [{ productDesignId: 'asc' }, { version: 'desc' }],
  })

  return NextResponse.json(successResponse(costings))
}

// POST /api/rnd/costing — 创建成本核算
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'costing.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIp(req)

  // 验证产品存在
  const product = await prisma.productDesign.findUnique({ where: { id: body.productDesignId } })
  if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  // 自动计算版本号
  const lastVersion = await prisma.productCosting.findFirst({
    where: { productDesignId: body.productDesignId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const version = (lastVersion?.version || 0) + 1

  // 解析数值
  const rawMaterialCost = parseFloat(body.rawMaterialCost) || 0
  const packagingCost = parseFloat(body.packagingCost) || 0
  const oemFee = parseFloat(body.oemFee) || 0
  const testingFee = parseFloat(body.testingFee) || 0
  const certificationFee = parseFloat(body.certificationFee) || 0
  const otherCost = parseFloat(body.otherCost) || 0
  const outputQty = parseInt(body.outputQty) || 0
  const targetMargin = body.targetMargin !== undefined && body.targetMargin !== ''
    ? parseFloat(body.targetMargin) : null

  // 自动计算
  const totalCost = rawMaterialCost + packagingCost + oemFee + testingFee + certificationFee + otherCost
  const unitCost = outputQty > 0 ? totalCost / outputQty : 0

  // 建议零售价 = unitCost / (1 - targetMargin/100)
  let suggestedPrice = 0
  if (targetMargin !== null && targetMargin > 0 && targetMargin < 100) {
    suggestedPrice = unitCost / (1 - targetMargin / 100)
  } else if (targetMargin !== null && targetMargin >= 100) {
    suggestedPrice = unitCost * (1 + targetMargin / 100)
  } else {
    suggestedPrice = unitCost
  }

  const costing = await prisma.productCosting.create({
    data: {
      productDesignId: body.productDesignId,
      version,
      costingDate: body.costingDate ? new Date(body.costingDate) : new Date(),
      rawMaterialCost,
      packagingCost,
      oemFee,
      testingFee,
      certificationFee,
      otherCost,
      totalCost,
      outputQty,
      unitCost,
      targetMargin,
      suggestedPrice,
      actualPrice: body.actualPrice !== undefined && body.actualPrice !== ''
        ? parseFloat(body.actualPrice) : null,
      status: body.status || 'DRAFT',
      remark: body.remark || null,
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ProductCosting',
    entityId: costing.id,
    detail: { productDesignId: body.productDesignId, version },
    ip,
  })

  return NextResponse.json(successResponse(costing), { status: 201 })
}
