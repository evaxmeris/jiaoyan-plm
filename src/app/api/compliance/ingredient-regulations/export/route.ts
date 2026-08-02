import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'

// GET /api/compliance/ingredient-regulations/export
// 导出法规数据为JSON，支持按市场筛选
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'registration.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const market = searchParams.get('market')
  const regulationType = searchParams.get('regulationType')
  const category = searchParams.get('category')

  const where: any = { isActive: true }
  if (market) where.market = market
  if (regulationType) where.regulationType = regulationType
  if (category) where.category = category

  const items = await prisma.ingredientRegulation.findMany({
    where,
    orderBy: [{ market: 'asc' }, { nameCn: 'asc' }],
  })

  // 添加导出文件名信息
  const timestamp = new Date().toISOString().split('T')[0]
  const marketLabel = market || 'ALL'

  return NextResponse.json({
    exportInfo: {
      generatedAt: new Date().toISOString(),
      totalCount: items.length,
      market: market || 'ALL',
      fileName: `ingredient-regulations-${marketLabel}-${timestamp}.json`,
    },
    records: items,
  })
}
