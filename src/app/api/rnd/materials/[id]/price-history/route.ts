// GET /api/rnd/materials/[id]/price-history — 该原料行的价格变动历史
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'material.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }
  const { id } = await params

  const histories = await prisma.rawMaterialPrice.findMany({
    where: { rawMaterialId: id },
    orderBy: { recordedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      price: true,
      unit: true,
      supplier: true,
      purchaseOrderNo: true,
      batchNo: true,
      remark: true,
      recordedAt: true,
    },
  })

  return NextResponse.json(successResponse({ histories }))
}
