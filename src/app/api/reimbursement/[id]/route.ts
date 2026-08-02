import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { createApprovalFromFlow } from '@/lib/approval'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/reimbursement/[id] — 获取报销详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const { id } = await params

  const reimbursement = await prisma.reimbursement.findUnique({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, role: true } },
      purchaseApplication: { select: { id: true, code: true, title: true, totalAmount: true, status: true } },
    },
  })

  if (!reimbursement) return errorResponse('报销不存在', 404)

  // 从新审批系统获取审批记录
  const approvalRequest = await prisma.approvalRequest.findFirst({
    where: { entityType: 'Reimbursement', entityId: id },
    include: {
      approvals: {
        include: { approver: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { level: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 获取审计日志
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: 'Reimbursement', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // 返回兼容格式
  return NextResponse.json(successResponse({
    reimbursement: {
      ...reimbursement,
      approvals: (approvalRequest?.approvals || []).map((a: any) => ({
        id: a.id,
        level: a.level,
        action: a.action,
        comment: a.comment,
        createdAt: a.createdAt,
        applicant: a.approver,
        _fromApprovalRequest: true,
      })),
    },
    auditLogs,
  }))
}

// PUT /api/reimbursement/[id] — 更新报销/提交审批
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'reimbursement.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const old = await prisma.reimbursement.findUnique({ where: { id },
    include: {
      applicant: { select: { id: true, name: true, department: true } },
    },
  })
  if (!old) return errorResponse('报销不存在', 404)

  // 构建可更新字段
  const data: Record<string, unknown> = {}
  const allowedFields = ['description', 'amount', 'receipts', 'applicantId', 'purchaseApplicationId']

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'amount') {
        data[field] = parseFloat(body[field])
      } else {
        data[field] = body[field]
      }
    }
  }

  // 状态变更
  if (body.status && body.status !== old.status) {
    // 草稿 → 审批中
    if (body.status === 'PENDING_APPROVAL' && old.status === 'DRAFT') {
      data.status = 'PENDING_APPROVAL'
    }
    // 审批中 → 通过
    else if (body.status === 'APPROVED' && old.status === 'PENDING_APPROVAL') {
      data.status = 'APPROVED'
    }
    // 审批中 → 驳回
    else if (body.status === 'REJECTED' && old.status === 'PENDING_APPROVAL') {
      data.status = 'REJECTED'
    }
    // 驳回 → 重新提交草稿
    else if (body.status === 'DRAFT' && old.status === 'REJECTED') {
      data.status = 'DRAFT'
    }
  }

  const reimbursement = await prisma.reimbursement.update({ where: { id }, data })

  const action = body.status && body.status !== old.status ? 'STATUS_CHANGE' : 'UPDATE'
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action,
    entity: 'Reimbursement',
    entityId: id,
    detail: {
      oldStatus: old.status,
      newStatus: reimbursement.status,
      code: reimbursement.code,
    },
    ip,
  })

  // 提交审批时自动创建审批请求
  if (body.status === 'PENDING_APPROVAL' && old.status !== 'PENDING_APPROVAL') {
    try {
      const approvalRequest = await createApprovalFromFlow({
        entityType: 'Reimbursement',
        entityId: id,
        title: `报销审批: ${reimbursement.code} - ${reimbursement.description}`,
        requesterId: user.id,
        amount: Number(reimbursement.amount),
      })
      if (approvalRequest) {
        await writeAuditLog({
          userId: user.id,
          userName: user.name,
          action: 'CREATE',
          entity: 'ApprovalRequest',
          entityId: approvalRequest.id,
          detail: { entityType: 'Reimbursement', entityId: id, title: approvalRequest.title },
          ip,
        })
      }
    } catch (err) {
      console.error('自动创建审批请求失败:', err)
    }
  }

  // ── 审批通过时：预算扣减 + 关联采购状态更新 ──
  if (body.status === 'APPROVED' && old.status === 'PENDING_APPROVAL') {
    await prisma.$transaction(async (tx) => {
      // 1. 预算扣减（按申请人部门 + 本年度）
      if (old.applicant?.department) {
        const fiscalYear = new Date().getFullYear()
        const budget = await tx.budget.findFirst({
          where: {
            department: old.applicant.department,
            fiscalYear,
          },
        })
        if (budget) {
          await tx.budget.update({
            where: { id: budget.id },
            data: { usedAmount: { increment: Number(old.amount) } },
          })
        }
      }

      // 2. 如果关联了采购申请，更新其状态为 REIMBURSED
      if (old.purchaseApplicationId) {
        await tx.purchaseApplication.update({
          where: { id: old.purchaseApplicationId },
          data: { status: 'REIMBURSED' },
        })
      }
    })
  }

  return NextResponse.json(successResponse(reimbursement))
}

// DELETE /api/reimbursement/[id] — 删除报销（软删除）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'reimbursement.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const reimbursement = await prisma.reimbursement.findUnique({ where: { id } })
  if (!reimbursement) return errorResponse('报销不存在', 404)

  await prisma.reimbursement.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'Reimbursement',
    entityId: id,
    detail: { code: reimbursement.code },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
