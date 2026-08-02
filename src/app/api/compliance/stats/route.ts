import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/compliance/stats — 全局合规统计数据
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // ── 1. 法规库总条数（按市场分类） ──
  const regulationsByMarketRaw = await prisma.ingredientRegulation.groupBy({
    by: ['market'],
    where: { isActive: true },
    _count: true,
  })
  const regulationsByMarket: Record<string, number> = {}
  let totalRegulations = 0
  for (const row of regulationsByMarketRaw) {
    regulationsByMarket[row.market] = row._count
    totalRegulations += row._count
  }

  // ── 2. 配方扫描统计 ──
  // 总配方数（未删除）
  const totalFormulas = await prisma.formula.count({
    where: { isDeleted: false },
  })

  // 查询已有原料合规检查记录的原料ID
  const checkedRawMaterialRows = await prisma.ingredientCheck.findMany({
    select: { rawMaterialId: true },
    distinct: ['rawMaterialId'],
  })
  const checkedRawMaterialIds = new Set(checkedRawMaterialRows.map(r => r.rawMaterialId))

  // 查询所有配方中使用的原料 → 统计有检查记录的配方数
  const formulaItems = await prisma.formulaItem.findMany({
    select: { formulaId: true, rawMaterialId: true },
    where: { formula: { isDeleted: false } },
  })
  const formulaIdsWithCheck = new Set<string>()
  for (const item of formulaItems) {
    if (checkedRawMaterialIds.has(item.rawMaterialId)) {
      formulaIdsWithCheck.add(item.formulaId)
    }
  }
  const scannedFormulas = formulaIdsWithCheck.size

  // ── 3. 备案进度 ──
  // 产品总数（有配方关联的、已进入开发阶段的产品）
  const totalProducts = await prisma.productDesign.count({
    where: { isDeleted: false },
  })
  // 已经完成备案的产品数（REGISTERED）
  const registeredProducts = await prisma.registration.count({
    where: {
      isDeleted: false,
      status: 'REGISTERED',
    },
  })
  // 有备案记录的产品设计数（即"需要备案"的产品）
  const needRegistrationCount = await prisma.registration.groupBy({
    by: ['productId'],
    where: { isDeleted: false },
    _count: { id: true },
  }).then(rows => rows.length)

  // 待完成备案（有备案记录但尚未注册成功）
  const pendingRegistrationCount = needRegistrationCount - registeredProducts

  // ── 4. 到期预警（30天内） ──
  const expiringRegistrations = await prisma.registration.count({
    where: {
      isDeleted: false,
      status: 'REGISTERED',
      expiryDate: {
        gte: now,
        lte: thirtyDays,
      },
    },
  })

  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const expiredTestReports = await prisma.testEntrustment.count({
    where: {
      status: 'COMPLETED',
      completeDate: { lte: oneYearAgo },
    },
  })

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const criticalOverdueDocs = await prisma.registrationDocument.count({
    where: {
      status: 'PENDING',
      required: true,
      createdAt: { lte: thirtyDaysAgo },
      registration: {
        isDeleted: false,
        status: { in: ['APPLYING', 'SUPPLEMENT'] },
      },
    },
  })

  const totalAlerts30Days = expiringRegistrations + expiredTestReports + criticalOverdueDocs

  // ── 合规覆盖率 ──
  // 覆盖率 = (已扫描配方 + 已备案产品) / (总配方 + 需备案产品数)
  // 简化：取配方扫描率作为合规覆盖率指标
  const coverageRate = totalFormulas > 0
    ? Math.round((scannedFormulas / totalFormulas) * 100)
    : 0

  return NextResponse.json(successResponse({
    regulations: {
      total: totalRegulations,
      byMarket: regulationsByMarket,
    },
    formulaScan: {
      total: totalFormulas,
      scanned: scannedFormulas,
      pending: totalFormulas - scannedFormulas,
      rate: totalFormulas > 0 ? Math.round((scannedFormulas / totalFormulas) * 100) : 0,
    },
    registration: {
      totalProducts,
      registered: registeredProducts,
      needRegistration: needRegistrationCount,
      pending: pendingRegistrationCount,
      rate: needRegistrationCount > 0
        ? Math.round((registeredProducts / needRegistrationCount) * 100)
        : 0,
    },
    alerts: {
      total30Days: totalAlerts30Days,
      expiringRegistrations,
      expiredTestReports,
      criticalOverdueDocs,
    },
    coverage: {
      rate: coverageRate,
      label: coverageRate >= 80 ? '良好' : coverageRate >= 50 ? '一般' : '需加强',
    },
  }))
}
