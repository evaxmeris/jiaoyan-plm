import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/approval-requests/[id] — 获取单个审批请求详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'approval.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const request = await prisma.approvalRequest.findUnique({
    where: { id: id },
    include: {
      requester: {
        select: { id: true, name: true, email: true, role: true },
      },
      approvals: {
        include: {
          approver: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { level: 'asc' },
      },
    },
  })

  if (!request) {
    return errorResponse('审批请求不存在', 404)
  }

  return NextResponse.json(successResponse({ data: request }))
}

// PUT /api/approval-requests/[id] — 审批操作（通过/驳回）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'approval.approve', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { action, comment, approvalItemId } = body

  if (!action || !['APPROVED', 'REJECTED', 'RETURNED'].includes(action)) {
    return errorResponse('无效的审批操作，仅支持 APPROVED/REJECTED/RETURNED', 400)
  }

  // 获取审批请求
  const request = await prisma.approvalRequest.findUnique({
    where: { id: id },
    include: {
      approvals: { orderBy: { level: 'asc' } },
    },
  })

  if (!request) {
    return errorResponse('审批请求不存在', 404)
  }

  if (request.status !== 'PENDING' && request.status !== 'IN_PROGRESS') {
    return errorResponse('该审批请求已处理，无法再次审批', 400)
  }

  // 找到当前待审批的节点
  let targetItem
  if (approvalItemId) {
    targetItem = request.approvals.find(a => a.id === approvalItemId)
    if (!targetItem) {
      return errorResponse('审批节点不存在', 404)
    }
  } else {
    // 自动找到当前需要审批的节点（第一个 PENDING 的节点）
    targetItem = request.approvals.find(a => a.action === 'PENDING')
    if (!targetItem) {
      return errorResponse('未找到待审批节点', 400)
    }
  }

  // 验证审批权限：如果设置了 approverId，必须是当前用户
  if (targetItem.approverId && targetItem.approverId !== user.id) {
    return errorResponse('您不是此审批节点的审批人', 403)
  }

  // 更新审批节点
  await prisma.approvalItem.update({
    where: { id: targetItem.id },
    data: {
      action,
      comment: comment || null,
      approverId: user.id,
    },
  })

  // 根据操作更新审批请求状态
  if (action === 'REJECTED' || action === 'RETURNED') {
    await prisma.approvalRequest.update({
      where: { id: id },
      data: { status: action === 'REJECTED' ? 'REJECTED' : 'PENDING' },
    })
  } else {
    // APPROVED: 检查是否所有节点都已通过
    const updatedItems = await prisma.approvalItem.findMany({
      where: { requestId: id },
    })
    const allApproved = updatedItems.every(a => a.action === 'APPROVED')
    if (allApproved) {
      // 使用事务保证所有后置操作原子化
      await prisma.$transaction(async (tx) => {
        await tx.approvalRequest.update({
          where: { id: id },
          data: { status: 'APPROVED' },
        })

        // ── BP2: 采购申请审批通过后扣减预算 ──
        if (request.entityType === 'PurchaseApplication' && request.entityId) {
          const purchaseApp = await tx.purchaseApplication.findUnique({
            where: { id: request.entityId },
            include: { applicant: { select: { department: true } } },
          })
          if (purchaseApp?.applicant?.department && (request.amount || purchaseApp.totalAmount)) {
            const fiscalYear = new Date().getFullYear()
            const amount = request.amount
              ? Number(request.amount)
              : Number(purchaseApp.totalAmount)
            await tx.budget.updateMany({
              where: {
                department: purchaseApp.applicant.department,
                fiscalYear,
              },
              data: {
                usedAmount: { increment: amount },
              },
            })
          }
        }

        // ── BP6: 审批通过后自动更新业务状态 ──
        if (request.entityType === 'Reimbursement' && request.entityId) {
          await tx.reimbursement.update({
            where: { id: request.entityId },
            data: { status: 'APPROVED' },
          })
        }

        if (request.entityType === 'ServiceContract' && request.entityId) {
          await tx.serviceContract.update({
            where: { id: request.entityId },
            data: { status: 'ACTIVE' },
          })
        }

        // 支付类审批通过后自动创建支付记录
        if (request.entityType === 'Payment' && request.entityId && request.amount) {
          const existing = await tx.serviceContractPayment.findFirst({
            where: { remark: `审批通过:${id}` },
          })
          if (!existing) {
            await tx.serviceContractPayment.create({
              data: {
                contractId: request.entityId,
                amount: request.amount,
                paymentDate: new Date(),
                method: 'APPROVED',
                remark: `审批通过:${id} | ${request.title || ''}`,
              },
            })
          }
        }
      })
    } else {
      await prisma.approvalRequest.update({
        where: { id: id },
        data: { status: 'IN_PROGRESS' },
      })
    }
  }

  // 返回更新后的数据
  const updated = await prisma.approvalRequest.findUnique({
    where: { id: id },
    include: {
      requester: {
        select: { id: true, name: true, email: true, role: true },
      },
      approvals: {
        include: {
          approver: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { level: 'asc' },
      },
    },
  })

  return NextResponse.json(successResponse({ data: updated }))
}
