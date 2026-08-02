// 预算仪表盘 API — 聚合统计
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/finance/dashboard — 预算仪表盘数据
// 查询参数: fiscalYear (可选，默认当前年份)
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const fiscalYearStr = searchParams.get('fiscalYear')
  const fiscalYear = fiscalYearStr ? parseInt(fiscalYearStr) : new Date().getFullYear()

  // 1. 年度预算总览
  const budgets = await prisma.budget.findMany({
    where: { fiscalYear },
    orderBy: { department: 'asc' },
    include: {
      categories: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
    },
  })

  const budgetOverview = budgets.map(b => ({
    id: b.id,
    department: b.department,
    totalAmount: Number(b.totalAmount),
    usedAmount: Number(b.usedAmount),
    remaining: Number(b.totalAmount) - Number(b.usedAmount),
    usageRate: Number(b.totalAmount) > 0 ? Math.round((Number(b.usedAmount) / Number(b.totalAmount)) * 100) : 0,
    categories: b.categories.map(c => ({
      id: c.id,
      name: c.name,
      allocatedAmount: Number(c.allocatedAmount),
      usedAmount: Number(c.usedAmount),
      remaining: Number(c.allocatedAmount) - Number(c.usedAmount),
      usageRate: Number(c.allocatedAmount) > 0 ? Math.round((Number(c.usedAmount) / Number(c.allocatedAmount)) * 100) : 0,
    })),
  }))

  // 2. 年度汇总
  const totalBudget = budgets.reduce((s, b) => s + Number(b.totalAmount), 0)
  const totalUsed = budgets.reduce((s, b) => s + Number(b.usedAmount), 0)
  const totalRemaining = totalBudget - totalUsed
  const overallRate = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0

  // 3. 月度支出趋势（当年）
  const monthlyTransactions = await prisma.$queryRaw<Array<{ month: number; total: number }>>`
    SELECT
      EXTRACT(MONTH FROM "transactionDate")::int AS month,
      COALESCE(SUM(amount), 0)::numeric AS total
    FROM budget_transactions
    WHERE EXTRACT(YEAR FROM "transactionDate") = ${fiscalYear}
    GROUP BY month
    ORDER BY month
  `

  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const found = monthlyTransactions.find((r: any) => Number(r.month) === m)
    return { month: m, total: found ? Number(found.total) : 0 }
  })

  // 4. 部门支出排名
  const departmentRanking = budgets
    .map(b => ({
      department: b.department,
      totalAmount: Number(b.totalAmount),
      usedAmount: Number(b.usedAmount),
      usageRate: Number(b.totalAmount) > 0 ? Math.round((Number(b.usedAmount) / Number(b.totalAmount)) * 100) : 0,
    }))
    .sort((a, b) => b.usedAmount - a.usedAmount)

  // 5. 最近交易
  const recentTransactions = await prisma.budgetTransaction.findMany({
    where: {
      budget: { fiscalYear },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      budget: { select: { id: true, department: true } },
      category: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(successResponse({
    fiscalYear,
    totalBudget,
    totalUsed,
    totalRemaining,
    overallRate,
    departmentCount: budgets.length,
    transactionCount: monthlyTransactions.reduce((s, r: any) => s + Number(r.total), 0) > 0 ? '有' : '无',
    budgetOverview,
    monthlyTrend,
    departmentRanking,
    recentTransactions: recentTransactions.map(t => ({
      ...t,
      amount: Number(t.amount),
    })),
  }))
}
