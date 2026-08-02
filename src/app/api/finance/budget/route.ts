// 预算管理 API — 预算编制与执行跟踪
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/finance/budget — 获取预算列表（含使用明细）
// 支持查询参数：fiscalYear, department
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const department = searchParams.get('department')
  const fiscalYearStr = searchParams.get('fiscalYear')

  const where: any = {}
  if (department) where.department = department
  if (fiscalYearStr) where.fiscalYear = parseInt(fiscalYearStr)

  const budgets = await prisma.budget.findMany({
    where,
    orderBy: [{ fiscalYear: 'desc' }, { department: 'asc' }],
  })

  // 获取各部门各年度的采购申请占用明细
  const budgetDetails: any[] = []
  for (const b of budgets) {
    const applications = await prisma.purchaseApplication.findMany({
      where: {
        isDeleted: false,
        applicant: { department: b.department },
        createdAt: {
          gte: new Date(`${b.fiscalYear}-01-01T00:00:00Z`),
          lt: new Date(`${b.fiscalYear + 1}-01-01T00:00:00Z`),
        },
        status: { not: 'REJECTED' },
      },
      select: {
        id: true,
        code: true,
        title: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        applicant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 实际计算 usedAmount（从采购申请汇总）
    const calculatedUsed = applications.reduce((sum, a) => sum + Number(a.totalAmount), 0)

    budgetDetails.push({
      ...b,
      totalAmount: Number(b.totalAmount),
      usedAmount: Number(b.usedAmount),
      calculatedUsed,
      remaining: Number(b.totalAmount) - calculatedUsed,
      usageRate: Number(b.totalAmount) > 0 ? Math.round((calculatedUsed / Number(b.totalAmount)) * 100) : 0,
      applications,
    })
  }

  return NextResponse.json(successResponse({ budgets: budgetDetails }))
}

// POST /api/finance/budget — 创建/更新预算
// body: { department, fiscalYear, totalAmount }
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { department, fiscalYear, totalAmount } = body

  if (!department) return errorResponse('部门不能为空', 400)
  if (!fiscalYear) return errorResponse('财政年度不能为空', 400)
  if (totalAmount === undefined || totalAmount < 0) {
    return errorResponse('预算总额无效', 400)
  }

  // 验证部门合法性
  const validDepartments = ['研发部', '采购部', '市场部', '综合部']
  if (!validDepartments.includes(department)) {
    return errorResponse(`无效部门：${department}，可选：${validDepartments.join('、')}`, 400)
  }

  const budget = await prisma.budget.upsert({
    where: {
      department_fiscalYear: { department, fiscalYear },
    },
    update: {
      totalAmount,
    },
    create: {
      department,
      fiscalYear,
      totalAmount,
      usedAmount: 0,
    },
  })

  return NextResponse.json(successResponse({
    budget: {
      ...budget,
      totalAmount: Number(budget.totalAmount),
      usedAmount: Number(budget.usedAmount),
    },
  }))
}
