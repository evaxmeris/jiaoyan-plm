// 预算科目管理 API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/finance/budget-categories — 获取预算科目列表
// 查询参数: budgetId (必须)
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const budgetId = searchParams.get('budgetId')

  if (!budgetId) return errorResponse('缺少预算ID参数', 400)

  const where: any = { budgetId }
  const categories = await prisma.budgetCategory.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { transactions: true } },
    },
  })

  return NextResponse.json(successResponse({
    categories: categories.map(c => ({
      ...c,
      allocatedAmount: Number(c.allocatedAmount),
      usedAmount: Number(c.usedAmount),
    })),
  }))
}

// POST /api/finance/budget-categories — 创建预算科目
// body: { budgetId, name, allocatedAmount, sortOrder?, remark? }
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { budgetId, name, allocatedAmount, sortOrder, remark } = body

  if (!budgetId) return errorResponse('预算ID不能为空', 400)
  if (!name) return errorResponse('科目名称不能为空', 400)
  if (allocatedAmount === undefined || allocatedAmount < 0) {
    return errorResponse('分配金额无效', 400)
  }

  // 验证预算存在
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } })
  if (!budget) return errorResponse('预算记录不存在', 404)

  // 检查同名科目
  const existing = await prisma.budgetCategory.findUnique({
    where: { budgetId_name: { budgetId, name } },
  })
  if (existing) return errorResponse('该预算下已存在同名科目', 400)

  const category = await prisma.budgetCategory.create({
    data: {
      budgetId,
      name,
      allocatedAmount,
      sortOrder: sortOrder ?? 0,
      remark,
    },
  })

  return NextResponse.json(successResponse({
    category: {
      ...category,
      allocatedAmount: Number(category.allocatedAmount),
      usedAmount: Number(category.usedAmount),
    },
  }))
}
