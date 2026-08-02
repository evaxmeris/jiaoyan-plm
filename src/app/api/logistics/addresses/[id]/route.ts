import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/logistics/addresses/[id] — 收货地址详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping_address.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const address = await prisma.shippingAddress.findUnique({ where: { id } })
  if (!address) return errorResponse('收货地址不存在', 404)

  return NextResponse.json(successResponse(address))
}
