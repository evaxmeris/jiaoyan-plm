import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { FormulaSchema, validateBody } from '@/lib/validation'
import { autoCalculateCosting } from '@/app/api/rnd/costing/auto-costing'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'formula.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const isCEO = user.role === 'CEO'

  const where: any = q ? { isDeleted: false, name: { contains: q } } : { isDeleted: false }

  // 非 CEO 用户只能看到非核心配方
  if (!isCEO) {
    where.isCore = false
  }

  const include: any = { _count: { select: { versions: true } } }
  if (isCEO) {
    include.items = { include: { rawMaterial: true } }
  }

  const formulas = await prisma.formula.findMany({
    where,
    include,
    orderBy: { updatedAt: 'desc' },
  })

  // 非 CEO 用户看到的配方不返回成分数据
  const result = formulas.map((f) => {
    const { items, ...rest } = f
    return {
      ...rest,
      items: isCEO ? (items ?? []) : [],
    }
  })

  return NextResponse.json(successResponse(result))
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  if (!await verifyPermission(user.role, 'formula.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const validated = await validateBody(req, FormulaSchema.passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const code = `JY-FM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 999)).padStart(3,'0')}`

  // 成分 cost 未填时自动按该行原料当前价计算：cost = (percentage/100) × latestPrice（与 PUT 保存逻辑对齐）
  const rawItemIds = (body.items || []).map((item: any) => item.rawMaterialId).filter(Boolean)
  const rawMats = rawItemIds.length > 0
    ? await prisma.rawMaterial.findMany({
        where: { id: { in: rawItemIds } },
        select: { id: true, latestPrice: true },
      })
    : []
  const priceMap = new Map<string, number | null>(
    rawMats.map(r => [r.id, r.latestPrice]),
  )

  const normalizedItems = (body.items || []).map((item: any, i: number) => {
    const autoCost = item.cost !== null && item.cost !== undefined
      ? item.cost
      : (priceMap.get(item.rawMaterialId) != null
        ? Math.round((item.percentage / 100) * priceMap.get(item.rawMaterialId)! * 100) / 100
        : null)
    return {
      rawMaterialId: item.rawMaterialId,
      percentage: item.percentage,
      weight: item.weight || null,
      cost: autoCost,
      orderIndex: i,
      remark: item.remark || null,
    }
  })
  const totalCost = normalizedItems.reduce((sum: number, it: any) => sum + (it.cost ?? 0), 0)

  const formula = await prisma.formula.create({
    data: {
      name: body.name,
      code,
      batchSize: body.batchSize || null,
      status: body.status || 'DEVELOPING',
      isCore: body.isCore || false,
      processParams: body.processParams || null,
      remark: body.remark || null,
      totalCost,
      items: {
        create: normalizedItems,
      },
    },
    include: { items: { include: { rawMaterial: true } } },
  })

  // 创建版本历史
  await prisma.formulaVersion.create({
    data: {
      formulaId: formula.id,
      version: 'V1.0',
      snapshot: JSON.parse(JSON.stringify(formula)),
      changedBy: user.name,
      changeLog: '初始版本',
    },
  })

  // ── 配方创建 → 成本自动计算 ──────────────────────────────────
  if (body.items?.length > 0) {
    await autoCalculateCosting(formula.id, user).catch((err) =>
      console.error('[AutoCosting] 自动核算异常:', err),
    )
  }

  return NextResponse.json(successResponse(formula), { status: 201 })
}
