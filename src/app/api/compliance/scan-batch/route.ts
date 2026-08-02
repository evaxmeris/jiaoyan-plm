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

// POST /api/compliance/scan-batch
// 批量扫描多个配方，返回每个配方的合规状态汇总（不含详情，仅总体评分）
// 接收 { formulaIds: string[], market?: Market | 'ALL' }
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

  const { formulaIds, market } = body
  if (!Array.isArray(formulaIds) || formulaIds.length === 0) {
    return errorResponse('缺少 formulaIds 或为空', 400)
  }

  if (formulaIds.length > 100) {
    return errorResponse('单次最多扫描 100 个配方', 400)
  }

  const scanMarket: string = market || DEFAULT_MARKET

  // 1. 先从快照表读取已有的扫描结果
  const snapshots = await prisma.formulaComplianceSnapshot.findMany({
    where: { formulaId: { in: formulaIds } },
    orderBy: { scanDate: 'desc' },
  })
  const snapshotMap = new Map<string, typeof snapshots[0]>()
  for (const s of snapshots) {
    if (!snapshotMap.has(s.formulaId)) {
      snapshotMap.set(s.formulaId, s)
    }
  }

  // 2. 找出没有快照的配方，进行实时扫描
  const idsWithoutSnapshot = formulaIds.filter((id) => !snapshotMap.has(id))

  // 3. 查询没有快照的配方及其成分
  const formulas = idsWithoutSnapshot.length > 0
    ? await prisma.formula.findMany({
        where: { id: { in: idsWithoutSnapshot }, isDeleted: false },
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
    : []

  // 2. 获取活跃的禁用和限用法规（按市场筛选）
  const regulations = await prisma.ingredientRegulation.findMany({
    where: {
      isActive: true,
      regulationType: { in: ['PROHIBITED', 'RESTRICTED'] },
      ...(scanMarket !== 'ALL' ? { market: scanMarket as any } : {}),
    },
  })

  // 3. 先用快照数据填充结果
  const results: Record<string, {
    formulaId: string
    formulaName: string
    overall: OverallResult
    summary: { total: number; passed: number; warned: number; failed: number }
    hasProhibited: boolean
    hasRestricted: boolean
  }> = {}

  for (const [fId, snap] of snapshotMap) {
    const s = snap.summary as { total: number; passed: number; warned: number; failed: number }
    results[fId] = {
      formulaId: fId,
      formulaName: '', // 从实时扫描补全
      overall: snap.overallPass ? 'PASS' : (snap.hasProhibited ? 'FAIL' : 'WARN'),
      summary: s,
      hasProhibited: snap.hasProhibited,
      hasRestricted: snap.hasRestricted,
    }
  }

  // 4. 没有快照的配方进行实时扫描
  for (const formula of formulas) {
    if (formula.items.length === 0) {
      results[formula.id] = {
        formulaId: formula.id,
        formulaName: formula.name,
        overall: 'PASS',
        summary: { total: 0, passed: 0, warned: 0, failed: 0 },
        hasProhibited: false,
        hasRestricted: false,
      }
      continue
    }

    const scanResults: ScanResult[] = []

    for (const item of formula.items) {
      const rm = item.rawMaterial
      if (!rm.nameCn && !rm.casNo) {
        scanResults.push({
          rawMaterial: rm,
          regulation: null,
          result: 'PASS',
          type: null,
        })
        continue
      }

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
        scanResults.push({
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
        scanResults.push({
          rawMaterial: rm,
          regulation: null,
          result: 'PASS',
          type: null,
        })
      }
    }

    // 计算总体评分
    let overall: OverallResult = 'PASS'
    for (const r of scanResults) {
      if (r.result === 'FAIL') {
        overall = 'FAIL'
        break
      }
      if (r.result === 'WARN') {
        overall = 'WARN'
      }
    }

    const failedCount = scanResults.filter((r) => r.result === 'FAIL').length
    const warnedCount = scanResults.filter((r) => r.result === 'WARN').length

    results[formula.id] = {
      formulaId: formula.id,
      formulaName: formula.name,
      overall,
      summary: {
        total: scanResults.length,
        passed: scanResults.filter((r) => r.result === 'PASS').length,
        warned: warnedCount,
        failed: failedCount,
      },
      hasProhibited: failedCount > 0,
      hasRestricted: warnedCount > 0,
    }

    // 保存实时扫描结果到快照表（由scan-formula独立触发时也会保存，此处覆盖同步）
    await prisma.formulaComplianceSnapshot.deleteMany({
      where: { formulaId: formula.id },
    }).catch(() => {})
    await prisma.formulaComplianceSnapshot.create({
      data: {
        formulaId: formula.id,
        overallPass: overall === 'PASS',
        summary: {
          total: scanResults.length,
          passed: scanResults.filter((r) => r.result === 'PASS').length,
          warned: warnedCount,
          failed: failedCount,
        },
        hasProhibited: failedCount > 0,
        hasRestricted: warnedCount > 0,
      },
    }).catch(() => {})
  }

  // 为快照结果的配方补全名称（异步查询）
  const idsWithSnapshotOnly = formulaIds.filter((id) => !results[id]?.formulaName)
  if (idsWithSnapshotOnly.length > 0) {
    const formulasWithName = await prisma.formula.findMany({
      where: { id: { in: idsWithSnapshotOnly } },
      select: { id: true, name: true },
    })
    for (const f of formulasWithName) {
      if (results[f.id]) results[f.id].formulaName = f.name
    }
  }

  return NextResponse.json(successResponse({ results }))
}
