import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/materials/[id]/regulations — 查询原料的跨市场法规状态
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'material.view', user.id)) {
    return errorResponse('权限不足', 403)
  }
  const { id } = await params

  const material = await prisma.rawMaterial.findUnique({
    where: { id },
    select: { id: true, nameCn: true, nameEn: true, inciName: true, casNo: true },
  })
  if (!material) return errorResponse('原料不存在', 404)

  // 按名称和CAS号匹配法规库
  const whereOr: any[] = [{ nameCn: { contains: material.nameCn, mode: 'insensitive' } }]
  if (material.nameEn) whereOr.push({ nameEn: { contains: material.nameEn, mode: 'insensitive' } })
  if (material.inciName) whereOr.push({ inciName: { contains: material.inciName, mode: 'insensitive' } })
  if (material.casNo) whereOr.push({ casNo: material.casNo })

  const regulations = await prisma.ingredientRegulation.findMany({
    where: { OR: whereOr, isActive: true },
    select: {
      id: true, nameCn: true, nameEn: true, casNo: true,
      regulationType: true, market: true, maxConcentration: true,
      productTypeRestriction: true, restrictionNote: true,
      sourceRegulation: true, category: true,
    },
    orderBy: [{ market: 'asc' }, { regulationType: 'asc' }],
  })

  // 按市场分组
  const byMarket: Record<string, typeof regulations> = {}
  for (const r of regulations) {
    if (!byMarket[r.market]) byMarket[r.market] = []
    byMarket[r.market].push(r)
  }

  return NextResponse.json(successResponse({
    material: { id: material.id, nameCn: material.nameCn, nameEn: material.nameEn, casNo: material.casNo },
    regulations,
    byMarket,
    total: regulations.length,
  }))
}
