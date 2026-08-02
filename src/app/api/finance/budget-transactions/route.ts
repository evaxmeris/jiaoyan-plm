// 预算执行明细 API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/finance/budget-transactions — 获取预算执行明细
// 查询参数: budgetId (必须), categoryId (可选), page, pageSize
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const budgetId = searchParams.get('budgetId')
  const categoryId = searchParams.get('categoryId')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  if (!budgetId) return errorResponse('缺少预算ID参数', 400)

  const where: any = { budgetId }
  if (categoryId) where.categoryId = categoryId

  const [transactions, total] = await Promise.all([
    prisma.budgetTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.budgetTransaction.count({ where }),
  ])

  return NextResponse.json(successResponse({
    transactions: transactions.map(t => ({
      ...t,
      amount: Number(t.amount),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }))
}

// POST /api/finance/budget-transactions — 创建预算执行明细
// body: { budgetId, categoryId?, amount, type, description, referenceType?, referenceId?, transactionDate?, createdBy?, remark? }
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { budgetId, categoryId, amount, type, description, referenceType, referenceId, transactionDate, remark } = body

  if (!budgetId) return errorResponse('预算ID不能为空', 400)
  if (!amount || amount <= 0) return errorResponse('金额必须大于0', 400)
  if (!description) return errorResponse('支出说明不能为空', 400)

  // 验证预算存在
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } })
  if (!budget) return errorResponse('预算记录不存在', 404)

  // 如果指定了科目，验证科目存在
  if (categoryId) {
    const category = await prisma.budgetCategory.findUnique({ where: { id: categoryId } })
    if (!category) return errorResponse('预算科目不存在', 404)
    if (category.budgetId !== budgetId) return errorResponse('科目不属于该预算', 400)
  }

  const transaction = await prisma.$transaction(async (tx) => {
    // 创建交易记录
    const t = await tx.budgetTransaction.create({
      data: {
        budgetId,
        categoryId,
        amount,
        type: type || 'EXPENSE',
        description,
        referenceType,
        referenceId,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        createdBy: user.id,
        remark,
      },
    })

    // 更新预算已使用金额
    await tx.budget.update({
      where: { id: budgetId },
      data: { usedAmount: { increment: amount } },
    })

    // 更新科目已使用金额
    if (categoryId) {
      await tx.budgetCategory.update({
        where: { id: categoryId },
        data: { usedAmount: { increment: amount } },
      })
    }

    return t
  })

  return NextResponse.json(successResponse({
    transaction: { ...transaction, amount: Number(transaction.amount) },
  }))
}
