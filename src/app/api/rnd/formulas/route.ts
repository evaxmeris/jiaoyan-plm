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

  const formula = await prisma.formula.create({
    data: {
      name: body.name,
      code,
      batchSize: body.batchSize || null,
      status: body.status || 'DEVELOPING',
      isCore: body.isCore || false,
      processParams: body.processParams || null,
      remark: body.remark || null,
      items: {
        create: (body.items || []).map((item: any, i: number) => ({
          rawMaterialId: item.rawMaterialId,
          percentage: item.percentage,
          weight: item.weight || null,
          cost: item.cost || null,
          orderIndex: i,
          remark: item.remark || null,
        })),
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
