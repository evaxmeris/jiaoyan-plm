// POST /api/rnd/costing/calc-from-formula
// 从配方自动计算原料成本（从价格历史取价，兜底 latestPrice）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'costing.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await req.json()
  const { formulaId, batchQty } = body

  if (!formulaId) {
    return NextResponse.json({ error: '请指定配方' }, { status: 400 })
  }

  // 获取配方及所有成分的原料信息
  const formula = await prisma.formula.findFirst({
    where: { id: formulaId, isDeleted: false },
    include: {
      items: {
        include: {
          rawMaterial: {
            select: {
              id: true,
              nameCn: true,
              nameEn: true,
              latestPrice: true,
              unit: true,
            },
          },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (!formula) {
    return NextResponse.json({ error: '配方不存在' }, { status: 404 })
  }

  if (formula.items.length === 0) {
    return NextResponse.json({ error: '配方没有成分数据' }, { status: 400 })
  }

  // 核心配方 RBAC：非 CEO 用户不能查看核心配方中的原料价格
  if (formula.isCore && user.role !== 'CEO') {
    return NextResponse.json({ error: '无权访问核心保密配方' }, { status: 403 })
  }

  // 收集所有原料ID，批量查询价格历史中的最新价格
  const rawMaterialIds = formula.items
    .map(item => item.rawMaterial.id)
    .filter(Boolean)

  // 从 RawMaterialPrice 取每原料的最新价格（按 recordedAt 降序取第一条）
  const latestPrices = new Map<string, number>()
  if (rawMaterialIds.length > 0) {
    const priceRecords = await prisma.rawMaterialPrice.findMany({
      where: { rawMaterialId: { in: rawMaterialIds } },
      orderBy: { recordedAt: 'desc' },
      select: { rawMaterialId: true, price: true },
    })

    // 去重：只取每个原料第一条（已按 recordedAt desc 排序）
    for (const record of priceRecords) {
      if (!latestPrices.has(record.rawMaterialId)) {
        latestPrices.set(record.rawMaterialId, record.price)
      }
    }
  }

  // 计算每个原料的单位成本贡献 = (percentage/100) × 单价
  // 价格优先级：价格历史最新价 > latestPrice
  const items = formula.items.map((item) => {
    const historyPrice = latestPrices.get(item.rawMaterial.id)
    const unitPrice = historyPrice ?? item.rawMaterial.latestPrice ?? 0
    const contribution = (item.percentage / 100) * unitPrice
    return {
      rawMaterialId: item.rawMaterial.id,
      rawMaterialName: item.rawMaterial.nameCn || item.rawMaterial.nameEn || '',
      percentage: item.percentage,
      unitPrice,
      unit: item.rawMaterial.unit,
      contribution, // 每单位产品的此原料成本
      hasPrice: unitPrice > 0,
      priceSource: historyPrice !== undefined ? 'price_history' : (item.rawMaterial.latestPrice !== null ? 'latest_price' : 'none'),
    }
  })

  // 每单位产品的原料成本 = Σ(contribution)
  const unitCost = items.reduce((sum, item) => sum + item.contribution, 0)

  // 总原料成本 = unitCost × batchQty
  const qty = batchQty !== undefined ? parseFloat(batchQty) : (formula.batchSize || 0)
  const suggestedRawMaterialCost = qty > 0 ? unitCost * qty : 0

  return NextResponse.json(successResponse({
    formulaName: formula.name,
    formulaCode: formula.code,
    batchSize: formula.batchSize,
    batchQty: qty,
    unitCost: Math.round(unitCost * 100) / 100,
    suggestedRawMaterialCost: Math.round(suggestedRawMaterialCost * 100) / 100,
    items,
  }))
}
