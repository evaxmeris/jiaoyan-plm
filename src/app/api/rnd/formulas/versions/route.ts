// 配方版本历史 API
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/formulas/versions?formulaId=xxx
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'formula.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const formulaId = searchParams.get('formulaId')

  if (!formulaId) {
    return NextResponse.json({ error: '缺少 formulaId 参数' }, { status: 400 })
  }

  const versions = await prisma.formulaVersion.findMany({
    where: { formulaId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse(versions))
}
