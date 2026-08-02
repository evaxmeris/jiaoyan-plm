import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET() {
  const startTime = performance.now()
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'dashboard.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    rndFormulas,
    activeComplianceItems,
    suppliers,
    pendingApprovals,
    registeredTrademarks,
    authorizedPatents,
    pendingPurchases,
    registrations,
    oemContracts,
    lowStockMats,
    monthlyCostAgg,
    activeSampleTasks,
  ] = await Promise.all([
    prisma.formula.count({ where: { isDeleted: false } }),
    prisma.testEntrustment.count({ where: { status: { not: 'COMPLETED' }, isDeleted: false } }),
    prisma.supplier.count({ where: { isDeleted: false } }),
    prisma.purchaseApplication.count({ where: { status: 'PENDING', isDeleted: false } }),
    prisma.trademark.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, status: true, expireDate: true },
    }),
    prisma.patent.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, status: true, expireDate: true },
    }),
    prisma.purchaseApplication.findMany({
      where: { status: 'PENDING', isDeleted: false },
      select: { id: true, title: true, totalAmount: true, code: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.registration.findMany({
      where: { status: 'REGISTERED', isDeleted: false },
      select: { id: true, product: { select: { name: true } }, registerNo: true, expiryDate: true },
    }),
    prisma.oEMContract.findMany({
      where: { status: 'ACTIVE', isDeleted: false },
      select: { id: true, productName: true, contractNo: true, endDate: true },
    }),
    prisma.rawMaterial.findMany({
      where: {
        isDeleted: false,
        currentStock: { lte: prisma.rawMaterial.fields.minStock },
      },
      select: { id: true, nameCn: true, currentStock: true, minStock: true, unit: true },
    }),
    prisma.testEntrustment.aggregate({
      _sum: { cost: true },
      where: { createdAt: { gte: monthStart }, isDeleted: false, cost: { not: null } },
    }),
    prisma.sampleTask.count({
      where: { status: { notIn: ['COMPLETED', 'FAILED'] }, isDeleted: false },
    }),
  ])

  // ── 到期提醒逻辑 ──

  // 30天内到期的商标
  const expiringTrademarks = registeredTrademarks.filter(
    t => t.expireDate && new Date(t.expireDate) <= thirtyDays
  )
  // 30天内到期的专利
  const expiringPatents = authorizedPatents.filter(
    p => p.expireDate && new Date(p.expireDate) <= thirtyDays
  )
  // 60天内到期的预警（排除30天内的，避免重复）
  const warningTrademarks = registeredTrademarks.filter(
    t => t.expireDate && new Date(t.expireDate) > thirtyDays && new Date(t.expireDate) <= sixtyDays
  )
  const warningPatents = authorizedPatents.filter(
    p => p.expireDate && new Date(p.expireDate) > thirtyDays && new Date(p.expireDate) <= sixtyDays
  )

  // 原有提醒（保留兼容）
  const expiringRegistrations = registrations.filter(
    r => r.expiryDate && new Date(r.expiryDate) <= thirtyDays
  )
  const expiringContracts = oemContracts.filter(
    c => c.endDate && new Date(c.endDate) <= thirtyDays
  )

  // ── 预警总数计算（30天内红色 + 60天内黄色） ──
  const expiringRegistrationsCount = registrations.filter(
    r => r.expiryDate && new Date(r.expiryDate) <= sixtyDays && new Date(r.expiryDate) > now
  ).length
  const expiringTrademarksCount = registeredTrademarks.filter(
    t => t.expireDate && new Date(t.expireDate) <= sixtyDays && new Date(t.expireDate) > now
  ).length
  const expiringPatentFeesCount = await prisma.patentFee.count({
    where: {
      status: 'PENDING',
      dueDate: { gte: now, lte: sixtyDays },
    },
  })
  const expiringSupplierDocsCount = await prisma.supplierDocument.count({
    where: {
      expireDate: { gte: now, lte: sixtyDays },
    },
  })
  const expiringContractsCount = oemContracts.filter(
    c => c.endDate && new Date(c.endDate) <= sixtyDays && new Date(c.endDate) > now
  ).length

  const expiringItems = expiringRegistrationsCount + expiringTrademarksCount + expiringPatentFeesCount
    + expiringSupplierDocsCount + expiringContractsCount

  const elapsed = (performance.now() - startTime).toFixed(0)
  console.log(`[Dashboard] 数据加载完成，耗时 ${elapsed}ms`)

  return NextResponse.json(successResponse({
    stats: {
      rndFormulas,
      complianceItems: activeComplianceItems,
      suppliers,
      approvals: pendingApprovals,
      expiringItems,
      pendingApprovals,
      monthlySales: 0,
      rndProducts: rndFormulas,
    },
    alerts: {
      expiringTrademarks: expiringTrademarks.length,
      expiringPatents: expiringPatents.length,
      expiringRegistrations: expiringRegistrations.length,
      expiringContracts: expiringContracts.length,
      lowStockMaterials: lowStockMats.length,
      pendingApprovals,
      overdueInspections: activeComplianceItems,
      warningTrademarks: warningTrademarks.length,
      warningPatents: warningPatents.length,
    },
    monthlyInspectionCost: monthlyCostAgg._sum.cost || 0,
    activeSampleTasks,
    pendingPurchases,
    // 详细列表（30天）
    expiringTrademarksList: expiringTrademarks.map(t => ({ id: t.id, name: t.name, expireDate: t.expireDate })),
    expiringPatentsList: expiringPatents.map(p => ({ id: p.id, name: p.name, expireDate: p.expireDate })),
    // 详细列表（60天预警）
    warningTrademarksList: warningTrademarks.map(t => ({ id: t.id, name: t.name, expireDate: t.expireDate })),
    warningPatentsList: warningPatents.map(p => ({ id: p.id, name: p.name, expireDate: p.expireDate })),
    expiringRegistrationsList: registrations.filter(
      r => r.expiryDate && new Date(r.expiryDate) <= thirtyDays
    ),
    lowStockMaterials: lowStockMats,
  }))
}
