// 预算管理 API — 删除预算
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// DELETE /api/finance/budget/[id] — 删除预算
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const budget = await prisma.budget.findUnique({ where: { id } })
  if (!budget) return errorResponse('预算记录不存在', 404)

  // 检查是否已有占用金额
  if (Number(budget.usedAmount) > 0) {
    return errorResponse('该预算已有使用记录，无法删除', 400)
  }

  await prisma.budget.delete({ where: { id } })

  return NextResponse.json(successResponse({ success: true }))
}
