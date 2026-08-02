// 价格历史 CRUD API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/price-history — 获取价格历史列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'price_history.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  const where: any = {}
  if (productId) where.productDesignId = productId

  const histories = await prisma.priceHistory.findMany({
    where,
    include: { product: { select: { id: true, name: true, brand: true } } },
    orderBy: { effectiveDate: 'desc' },
  })

  return NextResponse.json(successResponse(histories))
}

// POST /api/rnd/price-history — 创建价格历史记录
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'price_history.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIp(req)

  // 验证产品存在
  const product = await prisma.productDesign.findUnique({ where: { id: body.productDesignId } })
  if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  // 创建价格历史时，同步更新最新成本核算的实际售价
  if (body.syncToCosting !== false) {
    const latestCosting = await prisma.productCosting.findFirst({
      where: { productDesignId: body.productDesignId },
      orderBy: { version: 'desc' },
    })
    if (latestCosting) {
      await prisma.productCosting.update({
        where: { id: latestCosting.id },
        data: { actualPrice: parseFloat(body.price) || 0 },
      })
    }
  }

  const history = await prisma.priceHistory.create({
    data: {
      productDesignId: body.productDesignId,
      price: parseFloat(body.price) || 0,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
      channel: body.channel || null,
      reason: body.reason || null,
    },
    include: { product: { select: { id: true, name: true, brand: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PriceHistory',
    entityId: history.id,
    detail: { productDesignId: body.productDesignId, price: history.price, channel: history.channel },
    ip,
  })

  return NextResponse.json(successResponse(history), { status: 201 })
}
