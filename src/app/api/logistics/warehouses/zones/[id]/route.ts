import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/logistics/warehouses/zones/[id] — 区域详情（含所有仓位）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'warehouse_zone.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const zone = await prisma.warehouseZone.findUnique({
    where: { id },
    include: {
      locations: {
        orderBy: { code: 'asc' },
      },
    },
  })
  if (!zone) return errorResponse('区域不存在', 404)

  return NextResponse.json(successResponse(zone))
}
