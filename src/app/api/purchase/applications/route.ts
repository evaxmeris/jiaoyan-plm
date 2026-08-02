import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PurchaseStatus } from '@prisma/client'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { PurchaseApplicationSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  // 获取当前激活的采购审批流程（用于前端展示审批进度）
  const flow = await prisma.approvalFlow.findFirst({
    where: { module: 'purchase', isActive: true },
    orderBy: { updatedAt: 'desc' },
  })

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status')

  const apps = await prisma.purchaseApplication.findMany({
    where: {
      isDeleted: false,
      ...(statusFilter ? { status: statusFilter as PurchaseStatus } : {}),
    },
    include: {
      applicant: { select: { name: true, email: true } },
      items: true,
      purchaseOrder: {
        select: { id: true, poNo: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 批量获取每个申请的审批请求（新系统）
  const appIds = apps.map(a => a.id)
  const approvalRequests = await prisma.approvalRequest.findMany({
    where: {
      entityType: 'PurchaseApplication',
      entityId: { in: appIds },
    },
    include: {
      approvals: {
        include: { approver: { select: { name: true } } },
        orderBy: { level: 'asc' },
      },
    },
  })

  // 按 application id 建立映射
  const approvalMap = new Map(approvalRequests.map(ar => [ar.entityId, ar]))

  // 将审批数据注入到每个应用中
  const appsWithApprovals = apps.map(app => {
    const ar = approvalMap.get(app.id)
    const approvals = (ar?.approvals || []).map(a => ({
      id: a.id,
      level: a.level,
      action: a.action,
      comment: a.comment,
      createdAt: a.createdAt,
      applicant: a.approver,
      _fromApprovalRequest: true,
    }))
    return { ...app, approvals }
  })

  return NextResponse.json(successResponse({ applications: appsWithApprovals, approvalFlow: flow }))
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  // ── 输入校验 ──
  const validated = await validateBody(req, PurchaseApplicationSchema)
  if (!validated.success) return validated.response

  const body = validated.data
  const code = `JY-AT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`

  // ── 预算校验 ──
  if (user.department) {
    const fiscalYear = new Date().getFullYear()
    const budget = await prisma.budget.findUnique({
      where: {
        department_fiscalYear: { department: user.department, fiscalYear },
      },
    })

    if (budget) {
      const used = Number(budget.usedAmount) || 0
      const total = Number(budget.totalAmount) || 0
      const newTotal = used + (body.totalAmount || 0)
      if (newTotal > total) {
        const remaining = total - used
        return NextResponse.json(
          {
            success: false,
            error: `部门预算不足：${user.department} 本年度预算 ¥${total.toFixed(2)}，已使用 ¥${used.toFixed(2)}，剩余 ¥${Math.max(0, remaining).toFixed(2)}，申请金额 ¥${(body.totalAmount || 0).toFixed(2)}`,
            budget: { totalAmount: total, usedAmount: used, remaining: Math.max(0, remaining) },
          },
          { status: 400 }
        )
      }
    }
  }

  const app = await prisma.purchaseApplication.create({
    data: {
      code,
      applicantId: user.id,
      title: body.title,
      category: body.category || 'RAW_MATERIAL',
      supplier: body.supplier || null,
      totalAmount: body.totalAmount || 0,
      urgency: body.urgency || 'NORMAL',
      purpose: body.purpose || '',
      items: {
        create: (body.items || []).map((item: any) => ({
          name: item.name,
          specification: item.specification || null,
          quantity: item.quantity || 0,
          unit: item.unit || '个',
          estimatedPrice: item.estimatedPrice || 0,
          totalPrice: (item.quantity || 0) * (item.estimatedPrice || 0),
          rawMaterialId: item.rawMaterialId || null,
          remark: item.remark || null,
        })),
      },
    },
    include: { items: true, applicant: { select: { name: true } } },
  })

  // 写入审计日志
  const { writeAuditLog, extractIp } = await import('@/lib/audit')
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PurchaseApplication',
    entityId: app.id,
    detail: { code, title: body.title, totalAmount: body.totalAmount, itemCount: (body.items || []).length },
    ip: extractIp(req),
  })

  return NextResponse.json(successResponse({ application: app }), { status: 201 })
}
