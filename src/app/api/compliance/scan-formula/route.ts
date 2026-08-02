import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { DEFAULT_MARKET } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

interface ScanResult {
  rawMaterial: {
    id: string
    nameCn: string
    casNo: string | null
    inciName: string | null
  }
  regulation: {
    id: string
    nameCn: string
    regulationType: 'PROHIBITED' | 'RESTRICTED'
    casNo: string | null
    sourceRegulation: string
    maxConcentration: number | null
    restrictionNote: string | null
  } | null
  result: 'FAIL' | 'WARN' | 'PASS'
  type: 'PROHIBITED' | 'RESTRICTED' | null
}

type OverallResult = 'PASS' | 'WARN' | 'FAIL'

// POST /api/compliance/scan-formula
// 扫描配方中的原料，对照法规库进行合规检查
// 请求体: { formulaId, market?: Market | 'ALL' }
// market 默认 'CHINA'，传 'ALL' 时匹配所有市场
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return errorResponse('请求体格式错误', 400)
  }

  const { formulaId, market } = body
  if (!formulaId) {
    return errorResponse('缺少 formulaId', 400)
  }

  const scanMarket: string = market || DEFAULT_MARKET

  // 1. 查询配方及其成分
  const formula = await prisma.formula.findUnique({
    where: { id: formulaId, isDeleted: false },
    include: {
      items: {
        include: {
          rawMaterial: {
            select: { id: true, nameCn: true, casNo: true, inciName: true },
          },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (!formula) {
    return errorResponse('配方不存在', 404)
  }

  if (formula.items.length === 0) {
    return NextResponse.json(successResponse({
      formulaId,
      formulaName: formula.name,
      results: [],
      overall: 'PASS' as OverallResult,
    }))
  }

  // 2. 获取活跃的禁用和限用法规（按市场筛选）
  const regulations = await prisma.ingredientRegulation.findMany({
    where: {
      isActive: true,
      regulationType: { in: ['PROHIBITED', 'RESTRICTED'] },
      ...(scanMarket !== 'ALL' ? { market: scanMarket as any } : {}),
    },
  })

  // 3. 逐原料扫描匹配
  const results: ScanResult[] = []

  for (const item of formula.items) {
    const rm = item.rawMaterial
    if (!rm.nameCn && !rm.casNo) {
      results.push({
        rawMaterial: rm,
        regulation: null,
        result: 'PASS',
        type: null,
      })
      continue
    }

    // 匹配规则：
    // a) nameCn 包含 rawMaterial.nameCn（名称匹配）
    // b) casNo 精确匹配
    const matched = regulations.find((reg) => {
      const nameMatch =
        rm.nameCn &&
        reg.nameCn.toLowerCase().includes(rm.nameCn.toLowerCase())
      const casMatch =
        rm.casNo &&
        reg.casNo !== null &&
        reg.casNo.toLowerCase() === rm.casNo!.toLowerCase()
      return nameMatch || casMatch
    })

    if (matched) {
      const isProhibited = matched.regulationType === 'PROHIBITED'
      results.push({
        rawMaterial: rm,
        regulation: {
          id: matched.id,
          nameCn: matched.nameCn,
          regulationType: matched.regulationType as 'PROHIBITED' | 'RESTRICTED',
          casNo: matched.casNo,
          sourceRegulation: matched.sourceRegulation,
          maxConcentration: matched.maxConcentration,
          restrictionNote: matched.restrictionNote,
        },
        result: isProhibited ? 'FAIL' : 'WARN',
        type: isProhibited ? 'PROHIBITED' : 'RESTRICTED',
      })
    } else {
      results.push({
        rawMaterial: rm,
        regulation: null,
        result: 'PASS',
        type: null,
      })
    }
  }

  // 4. 计算总体评分
  let overall: OverallResult = 'PASS'
  for (const r of results) {
    if (r.result === 'FAIL') {
      overall = 'FAIL'
      break
    }
    if (r.result === 'WARN') {
      overall = 'WARN'
    }
  }

  const failedCount = results.filter((r) => r.result === 'FAIL').length
  const warnedCount = results.filter((r) => r.result === 'WARN').length

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.result === 'PASS').length,
    warned: warnedCount,
    failed: failedCount,
  }

  // ── 保存扫描快照到数据库 ─────────────────────────────────
  // 删除该配方之前的快照，保留最新一条
  await prisma.formulaComplianceSnapshot.deleteMany({
    where: { formulaId },
  })
  await prisma.formulaComplianceSnapshot.create({
    data: {
      formulaId,
      overallPass: overall === 'PASS',
      summary,
      hasProhibited: failedCount > 0,
      hasRestricted: warnedCount > 0,
    },
  })

  return NextResponse.json(successResponse({
    formulaId: formula.id,
    formulaName: formula.name,
    results,
    overall,
    summary,
  }))
}
