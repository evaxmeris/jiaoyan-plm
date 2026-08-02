import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { ServiceContractSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/service-contracts — 获取服务合同列表
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'service_contract.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const contracts = await prisma.serviceContract.findMany({
    where: { isDeleted: false },
    orderBy: { updatedAt: 'desc' },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(successResponse({ contracts }))
}

// POST /api/service-contracts — 创建服务合同
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'service_contract.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const validated = await validateBody(req, ServiceContractSchema.passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  if (!body.name || !body.contractor || !body.amount || !body.signingDate) {
    return errorResponse('缺少必填字段（name/contractor/amount/signingDate）', 400)
  }

  // 预算校验：从请求的 body 提取 department，查询该部门当年的财政年预算
  const department = body.department
  if (department) {
    const fiscalYear = new Date().getFullYear()
    const budget = await prisma.budget.findFirst({
      where: { department, fiscalYear },
    })
    if (budget) {
      const totalBudget = Number(budget.totalAmount)
      const usedBudget = Number(budget.usedAmount)

      // 统计该部门年度待审批/已通过的合同占用额度
      const pendingAgg = await prisma.serviceContract.aggregate({
        where: {
          applicant: { department },
          status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
          isDeleted: false,
          createdAt: {
            gte: new Date(`${fiscalYear}-01-01T00:00:00Z`),
            lt: new Date(`${fiscalYear + 1}-01-01T00:00:00Z`),
          },
        },
        _sum: { amount: true },
      })
      const totalPending = Number(pendingAgg._sum.amount || 0)
      const newAmount = parseFloat(body.amount)
      const remaining = totalBudget - usedBudget - totalPending

      if (newAmount > remaining) {
        return NextResponse.json({
          success: false,
          error: `部门「${department}」本年度预算不足：可用余额 ¥${remaining.toFixed(2)}，合同金额 ¥${newAmount.toFixed(2)}`,
        }, { status: 400 })
      }
    }
  }

  const contract = await prisma.serviceContract.create({
    data: {
      name: body.name,
      contractor: body.contractor,
      type: body.type || 'OTHER',
      amount: parseFloat(body.amount),
      signingDate: new Date(body.signingDate),
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: body.status || 'DRAFT',
      fileUrl: body.fileUrl || null,
      remark: body.remark || null,
      applicantId: user.id,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ServiceContract',
    entityId: contract.id,
    detail: { name: contract.name, contractor: contract.contractor, amount: contract.amount, type: contract.type },
    ip,
  })

  return NextResponse.json(successResponse({ contract }), { status: 201 })
}
