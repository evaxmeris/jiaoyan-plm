import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/compliance/ingredient-regulations
// 列表查询，支持 ?nameCn=xxx&casNo=xxx 精确搜索、?search=xxx 通用模糊搜索、?market=EU 按市场筛选
// 以及 ?ingredientFunction=防腐剂&scope=驻留类 等扩展筛选
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'registration.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const nameCn = searchParams.get('nameCn')
  const casNo = searchParams.get('casNo')
  const search = searchParams.get('search')
  const regulationType = searchParams.get('regulationType')
  const market = searchParams.get('market')
  const ingredientFunction = searchParams.get('ingredientFunction') || searchParams.get('function')
  const scope = searchParams.get('scope')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  const where: any = { isActive: true }

  if (nameCn) {
    where.nameCn = { contains: nameCn, mode: 'insensitive' }
  }
  if (casNo) {
    where.casNo = { contains: casNo, mode: 'insensitive' }
  }
  if (search) {
    where.OR = [
      { nameCn: { contains: search, mode: 'insensitive' } },
      { casNo: { contains: search, mode: 'insensitive' } },
      { nameEn: { contains: search, mode: 'insensitive' } },
      { inciName: { contains: search, mode: 'insensitive' } },
      { ingredientFunction: { contains: search, mode: 'insensitive' } },
      { scope: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (regulationType) {
    where.regulationType = regulationType
  }
  if (market) {
    where.market = market
  }
  if (ingredientFunction) {
    where.ingredientFunction = { contains: ingredientFunction, mode: 'insensitive' }
  }
  if (scope) {
    where.scope = { contains: scope, mode: 'insensitive' }
  }

  const [items, total] = await Promise.all([
    prisma.ingredientRegulation.findMany({
      where,
      orderBy: { nameCn: 'asc' },
      skip,
      take: limit,
    }),
    prisma.ingredientRegulation.count({ where }),
  ])

  return NextResponse.json({
    ingredientRegulations: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

// POST /api/compliance/ingredient-regulations
// 新增法规条目，需要 COMPLIANCE 权限
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'registration.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  if (!body.nameCn || !body.regulationType || !body.sourceRegulation) {
    return NextResponse.json({ error: '缺少必填字段：nameCn, regulationType, sourceRegulation' }, { status: 400 })
  }

  if (!['PROHIBITED', 'RESTRICTED', 'ALLOWED'].includes(body.regulationType)) {
    return NextResponse.json({ error: 'regulationType 必须为 PROHIBITED / RESTRICTED / ALLOWED' }, { status: 400 })
  }

  const validMarkets = ['CHINA', 'EU', 'US', 'KSA', 'JP', 'KR', 'MY', 'PH', 'RU', 'GB']
  const market = body.market && validMarkets.includes(body.market) ? body.market : 'CHINA'

  const record = await prisma.ingredientRegulation.create({
    data: {
      nameCn: body.nameCn,
      nameEn: body.nameEn || null,
      inciName: body.inciName || null,
      casNo: body.casNo || null,
      regulationType: body.regulationType,
      market: market as any,
      maxConcentration: body.maxConcentration != null ? body.maxConcentration : null,
      productTypeRestriction: body.productTypeRestriction || null,
      restrictionNote: body.restrictionNote || null,
      sourceRegulation: body.sourceRegulation,
      category: body.category || null,
      scope: body.scope || null,
      ingredientFunction: body.ingredientFunction || null,
      referenceFile: body.referenceFile || null,
    },
  })

  const { writeAuditLog, extractIp } = await import('@/lib/audit')
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ingredientRegulation',
    entityId: record.id,
    detail: { nameCn: record.nameCn, regulationType: record.regulationType },
    ip: extractIp(req),
  })

  return NextResponse.json({ ingredientRegulation: record }, { status: 201 })
}
