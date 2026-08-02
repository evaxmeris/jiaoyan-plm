import { prisma } from '@/lib/prisma'

/// entityType → ApprovalFlow module 映射表
const ENTITY_TYPE_TO_MODULE: Record<string, string> = {
  PurchaseApplication: 'purchase',
  ServiceContract: 'service_contract',
  UserRegistration: 'user_registration',
  Reimbursement: 'purchase',
  Patent: 'purchase',
  Trademark: 'purchase',
  Payment: 'purchase',
}

/**
 * 根据 entityType 查找对应的激活审批流
 */
export async function findApprovalFlow(entityType: string) {
  const module = ENTITY_TYPE_TO_MODULE[entityType]
  if (!module) return null

  return prisma.approvalFlow.findFirst({
    where: { module, isActive: true },
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * 从审批流创建 ApprovalRequest（含 ApprovalItem 节点）
 * @param entityType 实体类型（如 'ServiceContract'）
 * @param entityId 实体 ID
 * @param title 审批标题
 * @param requesterId 申请人 ID
 * @param amount 涉及金额（可选）
 * @returns 创建的 ApprovalRequest 或 null（无匹配流时）
 */
export async function createApprovalFromFlow(params: {
  entityType: string
  entityId: string
  title: string
  requesterId: string
  amount?: number | null
}) {
  const { entityType, entityId, title, requesterId, amount } = params

  const flow = await findApprovalFlow(entityType)
  if (!flow) return null

  // 解析审批阶段
  const stages = (flow.stages as any[]) || []
  if (stages.length === 0) return null

  // 创建审批请求
  const request = await prisma.approvalRequest.create({
    data: {
      entityType,
      entityId,
      title,
      amount: amount ?? null,
      requesterId,
      status: 'PENDING',
      approvals: {
        create: stages.map((stage: any) => ({
          level: stage.level,
          role: stage.role || null,
          approverId: stage.approverId || null,
          action: 'PENDING',
        })),
      },
    },
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

  return request
}
