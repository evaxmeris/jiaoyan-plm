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

  // 每个原料行的当前价 = 该行原料的 latestPrice（手输/采购收货维护，旧价沉淀在价格历史）
  // 单位成本贡献 = (percentage/100) × 单价
  const items = formula.items.map((item) => {
    const unitPrice = item.rawMaterial.latestPrice ?? 0
    const contribution = (item.percentage / 100) * unitPrice
    return {
      rawMaterialId: item.rawMaterial.id,
      rawMaterialName: item.rawMaterial.nameCn || item.rawMaterial.nameEn || '',
      percentage: item.percentage,
      unitPrice,
      unit: item.rawMaterial.unit,
      contribution, // 每单位产品的此原料成本
      hasPrice: unitPrice > 0,
      priceSource: item.rawMaterial.latestPrice !== null ? 'latest_price' : 'none',
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
