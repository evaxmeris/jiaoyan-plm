import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { createApprovalFromFlow } from '@/lib/approval'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/purchase/applications/[id] — 获取采购申请详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const application = await prisma.purchaseApplication.findFirst({
    where: { id, isDeleted: false },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
      supplierR: { select: { id: true, name: true, contact: true, phone: true } },
      items: {
        include: {
          rawMaterial: { select: { id: true, nameCn: true, unit: true } },
          product: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!application) return errorResponse('采购申请不存在', 404)

  // 获取关联的审计日志
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: 'PurchaseApplication', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // 从新审批系统获取审批记录（兼容前端 data.approvals 格式）
  const approvalRequest = await prisma.approvalRequest.findFirst({
    where: { entityType: 'PurchaseApplication', entityId: id },
    include: {
      approvals: {
        include: {
          approver: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { level: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 映射为新旧兼容格式
  const approvals = (approvalRequest?.approvals || []).map((a: any) => ({
    id: a.id,
    level: a.level,
    action: a.action,
    comment: a.comment,
    createdAt: a.createdAt,
    applicant: a.approver, // 前端使用 applicant 字段
    _fromApprovalRequest: true,
  }))

  return NextResponse.json(successResponse({ application, auditLogs, approvals }))
}

// 生成内部批次号: JY-RM-YYYYMMDD-XXX
function generateBatchNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(Math.floor(Math.random() * 999)).padStart(3, '0')
  return `JY-RM-${date}-${seq}`
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'purchase.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { status, comment } = body

  // 获取旧状态
  const oldApp = await prisma.purchaseApplication.findUnique({
    where: { id },
    include: {
      items: { include: { rawMaterial: true } },
      applicant: { select: { id: true, name: true, department: true } },
    },
  })
  if (!oldApp) return errorResponse('采购申请不存在', 404)

  // ── 第一次提交审批: 创建 ApprovalRequest ──
  if (status === 'PENDING') {
    // 检查是否已有审批请求，避免重复创建
    const existing = await prisma.approvalRequest.findFirst({
      where: { entityType: 'PurchaseApplication', entityId: id },
    })
    const updated = await prisma.purchaseApplication.update({
      where: { id },
      data: { status: 'PENDING' },
    })

    // 如果没有审批请求则创建
    if (!existing) {
      try {
        await createApprovalFromFlow({
          entityType: 'PurchaseApplication',
          entityId: id,
          title: `采购审批: ${updated.title || updated.code}`,
          requesterId: user.id,
          amount: Number(oldApp.totalAmount),
        })
      } catch (err) {
        console.error('自动创建审批请求失败:', err)
      }
    }

    // 写入审计日志
    const { writeAuditLog, extractIp } = await import('@/lib/audit')
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'STATUS_CHANGE',
      entity: 'PurchaseApplication',
      entityId: id,
      detail: { oldStatus: 'DRAFT', newStatus: 'PENDING' },
      ip: extractIp(req),
    })

    return NextResponse.json(successResponse({ application: updated }))
  }

  // ── 多级审批逻辑 ──
  if (['APPROVED', 'REJECTED'].includes(status)) {
    // 获取审批流程配置
    const flow = await prisma.approvalFlow.findFirst({
      where: { module: 'purchase', isActive: true },
    })

    if (!flow) {
      return errorResponse('未配置审批流程，请联系管理员设置', 400)
    }

    const stages = flow.stages as any[]
    if (!stages || stages.length === 0) {
      return errorResponse('审批流程配置为空，请联系管理员', 400)
    }

    // 从 ApprovalRequest 获取已通过的审批节点（兼容新旧）
    const approvalRequest = await prisma.approvalRequest.findFirst({
      where: { entityType: 'PurchaseApplication', entityId: id },
      include: {
        approvals: { orderBy: { level: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!approvalRequest) {
      return errorResponse('未找到对应的审批请求，请先提交审批', 400)
    }

    // 当前已通过的审批级别数
    const existingApprovals = approvalRequest.approvals.filter(a => a.action === 'APPROVED')
    const approvedLevels = existingApprovals.length

    // 确定当前需要审批的阶段
    const amount = Number(oldApp.totalAmount)
    const matchingStages = stages.filter((s: any) => {
      if (!s.condition) return true
      return evaluateCondition(s.condition, amount)
    })
    matchingStages.sort((a: any, b: any) => a.level - b.level)

    if (status === 'REJECTED') {
      // 驳回：释放预算占用 + 更新审批节点
      await prisma.$transaction(async (tx) => {
        // 释放预算
        if (oldApp.applicant?.department) {
          const budget = await tx.budget.findFirst({
            where: { department: oldApp.applicant.department },
            orderBy: { createdAt: 'desc' },
          })
          if (budget) {
            await tx.budget.update({
              where: { id: budget.id },
              data: { usedAmount: { decrement: Number(oldApp.totalAmount) } },
            })
          }
        }

        // 更新采购申请状态
        await tx.purchaseApplication.update({
          where: { id },
          data: { status: 'REJECTED' },
        })

        // 找到当前待审批节点，更新为 REJECTED
        const pendingItem = approvalRequest.approvals.find(a => a.action === 'PENDING')
        if (pendingItem) {
          await tx.approvalItem.update({
            where: { id: pendingItem.id },
            data: { action: 'REJECTED', comment: comment || null, approverId: user.id },
          })
        }

        // 更新 ApprovalRequest 状态
        await tx.approvalRequest.update({
          where: { id: approvalRequest.id },
          data: { status: 'REJECTED' },
        })
      })
      return NextResponse.json(successResponse({ message: '已驳回，预算已释放' }))
    }

    // ── 通过逻辑 ──
    if (approvedLevels >= matchingStages.length) {
      return errorResponse('该申请已完成所有审批级别', 400)
    }

    const currentStage = matchingStages[approvedLevels]

    // 检查审批权限
    const hasApproverIdMatch = currentStage.approverId && currentStage.approverId === user.id
    const hasRoleMatch = currentStage.role && user.role === currentStage.role
    const isCEO = user.role === 'CEO'

    if (!isCEO && !hasApproverIdMatch && !hasRoleMatch) {
      let errorMsg = `您的角色（${user.role}）无权限`
      if (currentStage.approverId) {
        errorMsg = `当前级别指定了具体审批人，您不是指定的审批人`
      } else if (currentStage.role) {
        errorMsg = `当前级别需要 ${currentStage.role} 审批，您的角色（${user.role}）无权限`
      }
      return errorResponse(errorMsg, 403)
    }

    if (currentStage.approverId && currentStage.role && !isCEO) {
      if (!(hasApproverIdMatch && hasRoleMatch)) {
        return errorResponse(
          `当前级别需要 ${currentStage.role} 角色且为指定审批人，您不满足条件`,
          403
        )
      }
    }

    // 预算检查（仅当是最后一级审批通过时）
    if (approvedLevels === matchingStages.length - 1 && oldApp.applicant.department) {
      const fiscalYear = new Date().getFullYear()
      const budget = await prisma.budget.findUnique({
        where: {
          department_fiscalYear: { department: oldApp.applicant.department, fiscalYear },
        },
      })
      if (budget) {
        const newUsed = Number(budget.usedAmount) + Number(oldApp.totalAmount)
        if (newUsed > Number(budget.totalAmount)) {
          const remaining = Math.max(0, Number(budget.totalAmount) - Number(budget.usedAmount))
          return errorResponse(
            `审批时预算不足：${oldApp.applicant.department} 本年度预算 ¥${Number(budget.totalAmount).toFixed(2)}，已使用 ¥${Number(budget.usedAmount).toFixed(2)}，剩余 ¥${remaining.toFixed(2)}，申请金额 ¥${Number(oldApp.totalAmount).toFixed(2)}`,
            400,
          )
        }
      }
    }

    // 使用事务写入
    const result = await prisma.$transaction(async (tx) => {
      // 找到当前待审批节点，更新为 APPROVED
      const pendingItem = approvalRequest.approvals.find(a => a.action === 'PENDING')
      if (pendingItem) {
        await tx.approvalItem.update({
          where: { id: pendingItem.id },
          data: { action: 'APPROVED', comment: comment || null, approverId: user.id },
        })
      }

      // 判断是否所有匹配的阶段都已通过
      const isLastLevel = approvedLevels + 1 >= matchingStages.length

      if (isLastLevel) {
        // 最后一级审批通过，更新状态
        await tx.purchaseApplication.update({
          where: { id },
          data: { status: 'APPROVED' },
        })

        // 更新 ApprovalRequest 状态
        await tx.approvalRequest.update({
          where: { id: approvalRequest.id },
          data: { status: 'APPROVED' },
        })
      } else {
        // 更新 ApprovalRequest 状态为中
        await tx.approvalRequest.update({
          where: { id: approvalRequest.id },
          data: { status: 'IN_PROGRESS' },
        })
      }

      return tx.purchaseApplication.findUnique({ where: { id } })
    })

    return NextResponse.json(successResponse({
      application: result,
      approvalProgress: {
        currentLevel: currentStage.level,
        approvedCount: approvedLevels + 1,
        totalLevels: matchingStages.length,
        isComplete: approvedLevels + 1 >= matchingStages.length,
        currentLabel: currentStage.label,
      },
    }))
  }

  // ── 非审批状态变更（ORDERED, RECEIVED, REIMBURSED）─
  if (oldApp.status !== 'APPROVED' && ['ORDERED', 'RECEIVED', 'REIMBURSED'].includes(status)) {
    return errorResponse('采购申请尚未通过审批', 400)
  }

  // 使用事务：状态变更 + 自动入库
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.purchaseApplication.update({
      where: { id },
      data: { status },
    })

    if (status === 'RECEIVED' && oldApp.status !== 'RECEIVED') {
      for (const item of oldApp.items) {
        if (!item.rawMaterialId) continue

        const batch = await tx.rawMaterialBatch.create({
          data: {
            rawMaterialId: item.rawMaterialId,
            batchNo: item.remark || `PO-${oldApp.code}`,
            internalBatch: generateBatchNo(),
            quantity: item.quantity,
            receiptDate: new Date(),
            supplier: oldApp.supplier || '未知供应商',
            status: 'IN_STOCK',
            remark: `采购单 ${oldApp.code} 自动入库`,
          },
        })

        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { currentStock: { increment: item.quantity } },
        })
      }
    }

    return app
  })

  return NextResponse.json(successResponse({ application: result }))
}

// 评估条件表达式如: amount<=5000, amount>5000
function evaluateCondition(condition: string, amount: number): boolean {
  const match = condition.match(/^amount\s*(<=|>=|<|>|=)\s*(\d+)$/)
  if (!match) return true
  const [, op, val] = match
  const threshold = parseInt(val, 10)
  switch (op) {
    case '<=': return amount <= threshold
    case '>=': return amount >= threshold
    case '<': return amount < threshold
    case '>': return amount > threshold
    case '=': return amount === threshold
    default: return true
  }
}
