import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'oem.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const prices = await prisma.oemPriceHistory.findMany({
    where: { contractId: id },
    orderBy: { effectiveDate: 'desc' },
  })
  return NextResponse.json(successResponse(prices))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'oem.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()

  // 验证合同存在
  const contract = await prisma.oEMContract.findUnique({ where: { id } })
  if (!contract) return errorResponse('合同不存在', 404)

  const price = await prisma.oemPriceHistory.create({
    data: {
      contractId: id,
      productName: body.productName,
      unitPrice: parseFloat(body.unitPrice) || 0,
      moq: body.moq ? parseInt(body.moq) : null,
      effectiveDate: new Date(body.effectiveDate),
      remark: body.remark || null,
    },
  })
  return NextResponse.json(successResponse(price), { status: 201 })
}
