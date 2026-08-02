// DELETE /api/service-contracts/[id]/payments/[pid] — 删除支付记录
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const token = req.cookies.get('token')?.value
  if (!token) return errorResponse('未认证', 401)
  if (!verifyToken(token)) return errorResponse('登录已过期', 401)

  const { pid, id } = await params
  try {
    const payment = await prisma.serviceContractPayment.findUnique({ where: { id: pid } })
    if (!payment || payment.contractId !== id) {
      return errorResponse('支付记录不存在', 404)
    }
    await prisma.serviceContractPayment.delete({ where: { id: pid } })
    return NextResponse.json(successResponse({ deleted: true }))
  } catch (error) {
    console.error('删除支付记录失败:', error)
    return errorResponse('删除失败', 500)
  }
}
