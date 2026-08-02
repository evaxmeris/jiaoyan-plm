import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// POST /api/compliance/ingredient-regulations/batch-import
// 批量导入法规数据（支持 upsert by nameCn+market）
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

  const records = Array.isArray(body) ? body : body.records
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: '请提供 records 数组' }, { status: 400 })
  }

  if (records.length > 5000) {
    return NextResponse.json({ error: '单次批量导入最多 5000 条' }, { status: 400 })
  }

  const validMarkets = ['CHINA', 'EU', 'US', 'KSA', 'JP', 'KR', 'MY', 'PH', 'RU', 'GB']
  const validTypes = ['PROHIBITED', 'RESTRICTED', 'ALLOWED']

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: { index: number; nameCn: string; error: string }[] = []

  for (let i = 0; i < records.length; i++) {
    const r = records[i]

    // 基本校验
    if (!r.nameCn || !r.sourceRegulation) {
      skipped++
      continue
    }

    const regulationType = r.regulationType
    if (!validTypes.includes(regulationType)) {
      errors.push({ index: i, nameCn: r.nameCn, error: `无效的 regulationType: ${regulationType}` })
      skipped++
      continue
    }

    const market = r.market && validMarkets.includes(r.market) ? r.market : 'CHINA'

    try {
      await prisma.ingredientRegulation.upsert({
        where: {
          nameCn_market: { nameCn: r.nameCn, market: market as any },
        },
        update: {
          nameEn: r.nameEn || null,
          inciName: r.inciName || null,
          casNo: r.casNo || null,
          regulationType,
          maxConcentration: r.maxConcentration != null ? r.maxConcentration : null,
          productTypeRestriction: r.productTypeRestriction || null,
          restrictionNote: r.restrictionNote || null,
          sourceRegulation: r.sourceRegulation,
          category: r.category || null,
          scope: r.scope || null,
          ingredientFunction: r.ingredientFunction || r.function || null,
          referenceFile: r.referenceFile || null,
          isActive: r.isActive !== false,
        },
        create: {
          nameCn: r.nameCn,
          nameEn: r.nameEn || null,
          inciName: r.inciName || null,
          casNo: r.casNo || null,
          regulationType,
          market: market as any,
          maxConcentration: r.maxConcentration != null ? r.maxConcentration : null,
          productTypeRestriction: r.productTypeRestriction || null,
          restrictionNote: r.restrictionNote || null,
          sourceRegulation: r.sourceRegulation,
          category: r.category || null,
          scope: r.scope || null,
          ingredientFunction: r.ingredientFunction || r.function || null,
          referenceFile: r.referenceFile || null,
          isActive: r.isActive !== false,
        },
      })
      updated++
      created++
    } catch (e: any) {
      errors.push({ index: i, nameCn: r.nameCn, error: e.message || '未知错误' })
      skipped++
    }
  }

  const { writeAuditLog, extractIp } = await import('@/lib/audit')
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'BATCH_IMPORT',
    entity: 'ingredientRegulation',
    detail: { total: records.length, created, updated, skipped, errors: errors.length },
    ip: extractIp(req),
  })

  return NextResponse.json({
    success: true,
    total: records.length,
    imported: created,
    updated,
    skipped,
    errors: errors.slice(0, 20),
  })
}
