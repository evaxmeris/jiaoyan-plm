import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/reimbursement — 获取报销列表
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'reimbursement.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const reimbursements = await prisma.reimbursement.findMany({
    where: { isDeleted: false },
    orderBy: { updatedAt: 'desc' },
    include: {
      applicant: { select: { id: true, name: true, email: true, role: true } },
      purchaseApplication: { select: { id: true, code: true, title: true, totalAmount: true } },
    },
  })

  return NextResponse.json(successResponse({ reimbursements }))
}

// POST /api/reimbursement — 创建报销
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'reimbursement.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.amount || !body.description) {
    return errorResponse('缺少必填字段（amount/description）', 400)
  }

  // 自动生成编号：RE-{year}{month}-{4位序号}
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `RE-${year}${month}-`

  const lastCode = await prisma.reimbursement.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  let seq = 1
  if (lastCode) {
    const parts = lastCode.code.split('-')
    seq = parseInt(parts[2] || '0', 10) + 1
  }
  const code = `${prefix}${String(seq).padStart(4, '0')}`

  // 如果关联了采购申请，验证采购申请是否存在
  if (body.purchaseApplicationId) {
    const purchaseApp = await prisma.purchaseApplication.findUnique({
      where: { id: body.purchaseApplicationId },
    })
    if (!purchaseApp) {
      return errorResponse('关联的采购申请不存在', 400)
    }
  }

  // 预算超支检查：创建报销时检查部门预算余额
  const applicantId = body.applicantId || user.id
  const applicantUser = await prisma.user.findUnique({
    where: { id: applicantId },
    select: { id: true, department: true },
  })
  if (applicantUser?.department) {
    const fiscalYear = new Date().getFullYear()
    const budget = await prisma.budget.findFirst({
      where: { department: applicantUser.department, fiscalYear },
    })
    if (budget) {
      const totalBudget = Number(budget.totalAmount)
      const usedBudget = Number(budget.usedAmount)

      // 加上本年度其他待审批报销（尚未扣减预算但已占用额度）
      const pendingAgg = await prisma.reimbursement.aggregate({
        where: {
          applicant: { department: applicantUser.department },
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
          error: `部门「${applicantUser.department}」本年度预算不足：可用余额 ¥${remaining.toFixed(2)}，报销金额 ¥${newAmount.toFixed(2)}`,
        }, { status: 400 })
      }
    }
  }

  const reimbursement = await prisma.reimbursement.create({
    data: {
      code,
      applicantId: body.applicantId || user.id,
      amount: parseFloat(body.amount),
      receipts: body.receipts || [],
      description: body.description,
      status: 'DRAFT',
      purchaseApplicationId: body.purchaseApplicationId || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'Reimbursement',
    entityId: reimbursement.id,
    detail: { code, amount: body.amount, description: body.description },
    ip,
  })

  return NextResponse.json(successResponse({ reimbursement }), { status: 201 })
}
