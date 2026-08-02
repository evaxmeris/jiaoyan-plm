import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  // ── 1. 备案到期预警 ──
  const registrations = await prisma.registration.findMany({
    where: { isDeleted: false, status: 'REGISTERED' },
    select: { id: true, product: { select: { name: true } }, registerNo: true, expiryDate: true },
  })

  const expiringRegistrations = registrations.filter(
    r => r.expiryDate && new Date(r.expiryDate) <= thirtyDays && new Date(r.expiryDate) > now
  )
  const warningRegistrations = registrations.filter(
    r => r.expiryDate && new Date(r.expiryDate) > thirtyDays && new Date(r.expiryDate) <= sixtyDays
  )

  // ── 2. 检测报告到期预警 ──
  // 检测完成超过1年未有新检测的记录视为"报告到期需更新"
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const expiredTestReports = await prisma.testEntrustment.findMany({
    where: {
      status: 'COMPLETED',
      isDeleted: false,
      completeDate: { lte: oneYearAgo },
    },
    select: {
      id: true,
      type: true,
      institution: true,
      completeDate: true,
      reportNo: true,
      product: { select: { name: true } },
      registration: { select: { registerNo: true } },
    },
    orderBy: { completeDate: 'asc' },
    take: 20,
  })

  // 检测完成超过半年但不到1年的（预警）
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
  const warningTestReports = await prisma.testEntrustment.findMany({
    where: {
      status: 'COMPLETED',
      isDeleted: false,
      completeDate: { gte: oneYearAgo, lte: sixMonthsAgo },
    },
    select: {
      id: true,
      type: true,
      institution: true,
      completeDate: true,
      reportNo: true,
      product: { select: { name: true } },
      registration: { select: { registerNo: true } },
    },
    orderBy: { completeDate: 'asc' },
    take: 20,
  })

  // ── 3. 备案材料超期提醒 ──
  // 备案创建超过30天但文档状态仍为PENDING的
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const overdueDocuments = await prisma.registrationDocument.findMany({
    where: {
      status: 'PENDING',
      required: true,
      registration: {
        isDeleted: false,
        status: { in: ['APPLYING', 'SUPPLEMENT'] },
      },
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      registration: {
        select: {
          id: true,
          registerNo: true,
          status: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  // 超30天未提交的
  const criticalOverdueDocs = overdueDocuments.filter(
    d => d.createdAt <= thirtyDaysAgo
  )
  const pendingDocs = overdueDocuments.filter(
    d => d.createdAt > thirtyDaysAgo
  )

  return NextResponse.json(successResponse({
    alerts: {
      // 备案到期
      expiringRegistrations: expiringRegistrations.length,
      expiringRegistrationsList: expiringRegistrations.map(r => ({
        id: r.id,
        name: r.product?.name || '未知产品',
        registerNo: r.registerNo,
        expireDate: r.expiryDate,
      })),
      warningRegistrations: warningRegistrations.length,
      warningRegistrationsList: warningRegistrations.map(r => ({
        id: r.id,
        name: r.product?.name || '未知产品',
        registerNo: r.registerNo,
        expireDate: r.expiryDate,
      })),
      // 检测报告到期
      expiredTestReports: expiredTestReports.length,
      expiredTestReportsList: expiredTestReports.map(r => ({
        id: r.id,
        type: r.type,
        institution: r.institution,
        completeDate: r.completeDate,
        reportNo: r.reportNo,
        productName: r.product?.name || '未知产品',
        registerNo: r.registration?.registerNo,
      })),
      warningTestReports: warningTestReports.length,
      warningTestReportsList: warningTestReports.map(r => ({
        id: r.id,
        type: r.type,
        institution: r.institution,
        completeDate: r.completeDate,
        reportNo: r.reportNo,
        productName: r.product?.name || '未知产品',
        registerNo: r.registration?.registerNo,
      })),
      // 备案材料超期
      criticalOverdueDocs: criticalOverdueDocs.length,
      criticalOverdueDocsList: criticalOverdueDocs.map(d => ({
        id: d.id,
        name: d.name,
        registrationId: d.registration.id,
        registerNo: d.registration.registerNo,
        productName: d.registration.product?.name,
        createdAt: d.createdAt,
      })),
      pendingDocs: pendingDocs.length,
      pendingDocsList: pendingDocs.map(d => ({
        id: d.id,
        name: d.name,
        registrationId: d.registration.id,
        registerNo: d.registration.registerNo,
        productName: d.registration.product?.name,
        createdAt: d.createdAt,
      })),
    },
    counts: {
      // 红色预警（30天内）
      critical: expiringRegistrations.length + expiredTestReports.length + criticalOverdueDocs.length,
      // 黄色预警（60天内/注意）
      warning: warningRegistrations.length + warningTestReports.length + pendingDocs.length,
    },
  }))
}
