// 预算管理 API — GET 查询 / POST 设置/更新部门预算
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/purchase/budget — 获取各部门预算
// 支持查询参数：department, fiscalYear
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

  return NextResponse.json(successResponse(budgets))
}

// POST /api/purchase/budget — 设置/更新部门预算
// body: { department, fiscalYear, totalAmount }
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  // 仅允许管理员/财务设置预算
  if (user.role !== 'CEO' && user.role !== 'FINANCE') {
    return errorResponse('仅总经理和财务可以设置预算', 403)
  }

  const body = await req.json()
  const { department, fiscalYear, totalAmount } = body

  if (!department) return errorResponse('部门不能为空', 400)
  if (!fiscalYear) return errorResponse('财政年度不能为空', 400)
  if (totalAmount === undefined || totalAmount < 0) {
    return errorResponse('预算总额无效', 400)
  }

  // upsert：部门+年度唯一，更新预算总额（保留已使用金额）
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

  return NextResponse.json(successResponse(budget))
}
