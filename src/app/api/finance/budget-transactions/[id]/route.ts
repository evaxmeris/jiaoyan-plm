// 预算执行明细 API — 单条记录操作（更新、删除）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type Params = Promise<{ id: string }>

// DELETE /api/finance/budget-transactions/[id] — 删除执行明细
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const transaction = await prisma.budgetTransaction.findUnique({
    where: { id },
    include: { budget: true, category: true },
  })
  if (!transaction) return errorResponse('记录不存在', 404)

  const amount = Number(transaction.amount)

  await prisma.$transaction(async (tx) => {
    // 删除交易记录
    await tx.budgetTransaction.delete({ where: { id } })

    // 扣减预算已使用金额
    await tx.budget.update({
      where: { id: transaction.budgetId },
      data: { usedAmount: { decrement: amount } },
    })

    // 扣减科目已使用金额
    if (transaction.categoryId) {
      await tx.budgetCategory.update({
        where: { id: transaction.categoryId },
        data: { usedAmount: { decrement: amount } },
      })
    }
  })

  return NextResponse.json(successResponse({ success: true }))
}
