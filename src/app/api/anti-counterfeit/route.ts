import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse, successResponseWithPagination } from '@/lib/api-response'

/**
 * 查询防伪码列表
 * GET /api/anti-counterfeit?page=1&pageSize=20&status=ACTIVE&productBatchId=xxx&keyword=xxx
 */
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'anti_counterfeit.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const status = searchParams.get('status')
  const productBatchId = searchParams.get('productBatchId')
  const keyword = searchParams.get('keyword')

  // 构建查询条件
  const where: any = {}
  if (status) where.status = status
  if (productBatchId) where.productBatchId = productBatchId
  if (keyword) where.code = { contains: keyword }

  const [codes, total] = await Promise.all([
    prisma.antiCounterfeitCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.antiCounterfeitCode.count({ where }),
  ])

  return NextResponse.json(successResponseWithPagination(codes, { page, limit: pageSize, total }))
}

/**
 * 批量作废防伪码
 * DELETE /api/anti-counterfeit
 * Body: { ids: string[] }
 */
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'anti-counterfeit.revoke', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('请选择要作废的防伪码', 400)
  }

  const ip = extractIp(req)

  const result = await prisma.antiCounterfeitCode.updateMany({
    where: { id: { in: ids }, status: { not: 'REVOKED' } },
    data: { status: 'REVOKED' },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'BATCH_REVOKE',
    entity: 'AntiCounterfeitCode',
    detail: { ids, count: result.count },
    ip,
  })

  return NextResponse.json(successResponse({ revokedCount: result.count }))
}
