import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export interface AlertItem {
  id: string
  type: 'registration_expiring' | 'trademark_expiring' | 'patent_fee_due' | 'supplier_doc_expiring' | 'contract_expiring'
  entityType: string
  entityId: string
  title: string
  dueDate: string
  urgency: 'high' | 'medium'
  daysLeft: number
  amount?: number
}

/**
 * GET /api/alerts
 * 统一预警引擎：扫描备案/商标/专利年费/供应商资质/合同到期
 * 返回按紧急程度排序的预警列表（最多50条）
 */
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'alert.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const alerts: AlertItem[] = []

  // ── 1. 备案到期预警 ──
  // Registration.expiryDate, 30天红色/60天黄色
  const registrations = await prisma.registration.findMany({
    where: { isDeleted: false, expiryDate: { not: null } },
    include: { product: { select: { name: true } } },
  })
  for (const r of registrations) {
    if (!r.expiryDate) continue
    const daysLeft = Math.ceil((r.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0 || daysLeft > 60) continue
    alerts.push({
      id: `reg-${r.id}`,
      type: 'registration_expiring',
      entityType: 'Registration',
      entityId: r.id,
      title: `备案到期 · ${r.product?.name || '未知产品'}`,
      dueDate: r.expiryDate.toISOString(),
      urgency: daysLeft <= 30 ? 'high' : 'medium',
      daysLeft,
    })
  }

  // ── 2. 商标到期预警 ──
  // Trademark.expireDate, 30天红色/60天黄色
  const trademarks = await prisma.trademark.findMany({
    where: { isDeleted: false, expireDate: { not: null } },
    select: { id: true, name: true, expireDate: true },
  })
  for (const t of trademarks) {
    if (!t.expireDate) continue
    const daysLeft = Math.ceil((t.expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0 || daysLeft > 60) continue
    alerts.push({
      id: `tm-${t.id}`,
      type: 'trademark_expiring',
      entityType: 'Trademark',
      entityId: t.id,
      title: `商标到期 · ${t.name}`,
      dueDate: t.expireDate.toISOString(),
      urgency: daysLeft <= 30 ? 'high' : 'medium',
      daysLeft,
    })
  }

  // ── 3. 专利年费预警 ──
  // PatentFee.dueDate + status=PENDING（未缴费）, 30天红色/60天黄色
  const patentFees = await prisma.patentFee.findMany({
    where: {
      status: 'PENDING',
      dueDate: { gte: now, lte: sixtyDays },
    },
    include: { patent: { select: { id: true, name: true } } },
    orderBy: { dueDate: 'asc' },
  })
  for (const pf of patentFees) {
    const daysLeft = Math.ceil((pf.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0 || daysLeft > 60) continue
    alerts.push({
      id: `pf-${pf.id}`,
      type: 'patent_fee_due',
      entityType: 'PatentFee',
      entityId: pf.id,
      title: `专利年费 · ${pf.patent?.name || '未知专利'}`,
      dueDate: pf.dueDate.toISOString(),
      urgency: daysLeft <= 30 ? 'high' : 'medium',
      daysLeft,
      amount: pf.amount,
    })
  }

  // ── 4. 供应商资质到期预警 ──
  // SupplierDocument.expireDate, 30天红色/60天黄色
  const supplierDocs = await prisma.supplierDocument.findMany({
    where: { expireDate: { not: null } },
    include: { supplier: { select: { name: true } } },
  })
  for (const doc of supplierDocs) {
    if (!doc.expireDate) continue
    const daysLeft = Math.ceil((doc.expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0 || daysLeft > 60) continue
    alerts.push({
      id: `sd-${doc.id}`,
      type: 'supplier_doc_expiring',
      entityType: 'SupplierDocument',
      entityId: doc.id,
      title: `供应商资质 · ${doc.supplier?.name || '未知供应商'} - ${doc.name}`,
      dueDate: doc.expireDate.toISOString(),
      urgency: daysLeft <= 30 ? 'high' : 'medium',
      daysLeft,
    })
  }

  // ── 5. 合同到期预警 ──
  // OEMContract.endDate, 30天红色/60天黄色
  const contracts = await prisma.oEMContract.findMany({
    where: { isDeleted: false, endDate: { lte: sixtyDays } },
    include: { supplier: { select: { name: true } } },
  })
  for (const c of contracts) {
    const daysLeft = Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0 || daysLeft > 60) continue
    alerts.push({
      id: `oem-${c.id}`,
      type: 'contract_expiring',
      entityType: 'OEMContract',
      entityId: c.id,
      title: `合同到期 · ${c.productName || '未知合同'} - ${c.supplier?.name || '未知供应商'}`,
      dueDate: c.endDate.toISOString(),
      urgency: daysLeft <= 30 ? 'high' : 'medium',
      daysLeft,
    })
  }

  // 按紧急程度排序：红色(high)在前，同急程度按剩余天数升序
  alerts.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1
    return a.daysLeft - b.daysLeft
  })

  return NextResponse.json(successResponse({
    alerts: alerts.slice(0, 50),
    total: alerts.length,
  }))
}
