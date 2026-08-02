// GET /api/service-contracts/[id]/payments — 获取支付记录
// POST /api/service-contracts/[id]/payments — 添加支付
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ServiceContractPaymentSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value
  if (!token) return errorResponse('未认证', 401)
  if (!verifyToken(token)) return errorResponse('登录已过期', 401)

  const { id } = await params
  try {
    const payments = await prisma.serviceContractPayment.findMany({
      where: { contractId: id },
      orderBy: { paymentDate: 'desc' },
    })
    return NextResponse.json(successResponse(payments))
  } catch (error) {
    console.error('获取支付记录失败:', error)
    return errorResponse('获取失败', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value
  if (!token) return errorResponse('未认证', 401)
  const payload = verifyToken(token)
  if (!payload) return errorResponse('登录已过期', 401)

  const { id } = await params
  try {
    const validated = await validateBody(req, ServiceContractPaymentSchema.passthrough())
    if (!validated.success) return validated.response
    const body = validated.data as any
    if (!body.amount || body.amount <= 0) {
      return errorResponse('支付金额必须大于0', 400)
    }
    if (!body.paymentDate) {
      return errorResponse('请选择支付日期', 400)
    }

    const payment = await prisma.serviceContractPayment.create({
      data: {
        contractId: id,
        amount: Number(body.amount),
        paymentDate: new Date(body.paymentDate),
        method: body.method || null,
        remark: body.remark || null,
      },
    })
    return NextResponse.json(successResponse(payment), { status: 201 })
  } catch (error) {
    console.error('添加支付记录失败:', error)
    return errorResponse('添加失败', 500)
  }
}
