import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { createApprovalFromFlow } from '@/lib/approval'
import { ServiceContractSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/service-contracts/[id] — 获取服务合同详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'service_contract.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const contract = await prisma.serviceContract.findUnique({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, role: true } },
    },
  })

  if (!contract) return errorResponse('服务合同不存在', 404)

  // 获取审计日志
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: 'ServiceContract', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(successResponse({ contract, auditLogs }))
}

// PUT /api/service-contracts/[id] — 更新服务合同/提交审批
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'service_contract.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const validated = await validateBody(req, ServiceContractSchema.passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  const oldContract = await prisma.serviceContract.findUnique({ where: { id } })
  if (!oldContract) return errorResponse('服务合同不存在', 404)

  // 构建可更新字段
  const data: Record<string, unknown> = {}
  const allowedFields = [
    'name', 'contractor', 'type', 'amount', 'signingDate',
    'startDate', 'endDate', 'status', 'fileUrl', 'remark',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (['signingDate', 'startDate', 'endDate'].includes(field)) {
        data[field] = body[field] ? new Date(body[field]) : null
      } else if (field === 'amount') {
        data[field] = parseFloat(body[field])
      } else {
        data[field] = body[field]
      }
    }
  }

  const contract = await prisma.serviceContract.update({ where: { id }, data })

  const action = body.status && body.status !== oldContract.status ? 'STATUS_CHANGE' : 'UPDATE'
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action,
    entity: 'ServiceContract',
    entityId: id,
    detail: {
      oldStatus: oldContract.status,
      newStatus: contract.status,
      name: contract.name,
    },
    ip,
  })

  // 提交审批时自动创建审批请求
  if (body.status === 'PENDING_APPROVAL' && oldContract.status !== 'PENDING_APPROVAL') {
    try {
      const approvalRequest = await createApprovalFromFlow({
        entityType: 'ServiceContract',
        entityId: id,
        title: `服务合同审批: ${contract.name}`,
        requesterId: user.id,
        amount: contract.amount,
      })
      if (approvalRequest) {
        await writeAuditLog({
          userId: user.id,
          userName: user.name,
          action: 'CREATE',
          entity: 'ApprovalRequest',
          entityId: approvalRequest.id,
          detail: { entityType: 'ServiceContract', entityId: id, title: approvalRequest.title },
          ip,
        })
      }
    } catch (err) {
      console.error('自动创建审批请求失败:', err)
      // 不阻塞主流程，只记录错误
    }
  }

  return NextResponse.json(successResponse(contract))
}

// DELETE /api/service-contracts/[id] — 删除服务合同
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'service_contract.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const contract = await prisma.serviceContract.findUnique({ where: { id } })
  if (!contract) return errorResponse('服务合同不存在', 404)

  await prisma.serviceContract.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ServiceContract',
    entityId: id,
    detail: { name: contract.name },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
