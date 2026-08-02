// 预算科目管理 API — 单科目操作
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type Params = Promise<{ id: string }>

// PUT /api/finance/budget-categories/[id] — 更新预算科目
export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { name, allocatedAmount, sortOrder, remark } = body

  const existing = await prisma.budgetCategory.findUnique({ where: { id } })
  if (!existing) return errorResponse('科目不存在', 404)

  const data: any = {}
  if (name !== undefined) data.name = name
  if (allocatedAmount !== undefined) {
    if (allocatedAmount < 0) return errorResponse('分配金额无效', 400)
    data.allocatedAmount = allocatedAmount
  }
  if (sortOrder !== undefined) data.sortOrder = sortOrder
  if (remark !== undefined) data.remark = remark

  const category = await prisma.budgetCategory.update({ where: { id }, data })

  return NextResponse.json(successResponse({
    category: { ...category, allocatedAmount: Number(category.allocatedAmount), usedAmount: Number(category.usedAmount) },
  }))
}

// DELETE /api/finance/budget-categories/[id] — 删除预算科目
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'budget.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const category = await prisma.budgetCategory.findUnique({ where: { id } })
  if (!category) return errorResponse('科目不存在', 404)
  if (Number(category.usedAmount) > 0) {
    return errorResponse('该科目已有使用记录，无法删除', 400)
  }

  await prisma.budgetCategory.delete({ where: { id } })

  return NextResponse.json(successResponse({ success: true }))
}
