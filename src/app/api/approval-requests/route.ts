import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { findApprovalFlow } from '@/lib/approval'
import { successResponse, successResponseWithPagination, errorResponse } from '@/lib/api-response'

// GET /api/approval-requests — 获取审批请求列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const entityType = searchParams.get('entityType')
  const requesterId = searchParams.get('requesterId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: any = {}

  // 权限过滤：CEO 看所有，其他人看自己的+需要自己审批的
  if (user.role !== 'CEO') {
    where.OR = [
      { requesterId: user.id },
      {
        approvals: {
          some: {
            approverId: user.id,
          },
        },
      },
    ]
  }

  if (status) where.status = status
  if (entityType) where.entityType = entityType
  if (requesterId) where.requesterId = requesterId

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.approvalRequest.count({ where }),
  ])

  return NextResponse.json(successResponseWithPagination(requests, { page, limit, total }))
}

// POST /api/approval-requests — 创建审批请求
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const body = await req.json()
  const { entityType, entityId, title, amount, approvals: approvalItems } = body

  if (!entityType || !entityId || !title) {
    return errorResponse('缺少必要字段: entityType, entityId, title', 400)
  }

  // 验证 entityType 是否在允许范围内
  const allowedTypes = ['PurchaseApplication', 'Reimbursement', 'Patent', 'Trademark', 'ServiceContract', 'Payment']
  if (!allowedTypes.includes(entityType)) {
    return errorResponse(`不支持的实体类型: ${entityType}`, 400)
  }

  // 创建审批请求及其审批节点
  let approvalsData

  if (Array.isArray(approvalItems) && approvalItems.length > 0) {
    // 显式提供审批节点
    approvalsData = {
      create: approvalItems.map((item: any, index: number) => ({
        level: item.level || index + 1,
        role: item.role || null,
        approverId: item.approverId || null,
        action: 'PENDING' as const,
      })),
    }
  } else {
    // 没有提供审批节点时，从审批流配置自动获取
    const flow = await findApprovalFlow(entityType)
    if (flow) {
      const stages = (flow.stages as any[]) || []
      approvalsData = {
        create: stages.map((stage: any) => ({
          level: stage.level,
          role: stage.role || null,
          approverId: stage.approverId || null,
          action: 'PENDING' as const,
        })),
      }
    } else {
      // 兜底：创建一个默认的待审批节点
      approvalsData = {
        create: [{ level: 1, action: 'PENDING' as const }],
      }
    }
  }

  const request = await prisma.approvalRequest.create({
    data: {
      entityType,
      entityId,
      title,
      amount: amount ? parseFloat(amount) : null,
      requesterId: user.id,
      status: 'PENDING',
      approvals: approvalsData,
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

  return NextResponse.json(successResponse({ data: request }), { status: 201 })
}
