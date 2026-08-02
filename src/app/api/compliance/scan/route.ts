import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/compliance/scan?q=原料名称或CAS号
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'formula.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) {
    return errorResponse('请输入原料名称或CAS号', 400)
  }

  // 尝试匹配 ingredient_regulations
  const regulations = await prisma.ingredientRegulation.findMany({
    where: {
      isActive: true,
      OR: [
        { nameCn: { contains: q } },
        { nameEn: { contains: q } },
        { inciName: { contains: q } },
        { casNo: { contains: q } },
      ],
    },
    orderBy: { regulationType: 'asc' },
  })

  return NextResponse.json(successResponse({ regulations, query: q }))
}
