import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, successResponseWithPagination, errorResponse } from '@/lib/api-response'

// GET /api/audit-log — 查询审计日志（仅 CEO）
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'audit_log.view', user.id)) {
    return errorResponse('权限不足，仅 CEO 可查看审计日志', 403)
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100)
  const entity = searchParams.get('entity') // 筛选：Formula / Inspection / 等
  const action = searchParams.get('action') // 筛选：CREATE / UPDATE / DELETE
  const userId = searchParams.get('userId')
  const search = searchParams.get('search') // 用户名搜索
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const where: Record<string, unknown> = {}
  if (entity) where.entity = entity
  if (action) where.action = action
  if (userId) where.userId = userId
  if (search) where.userName = { contains: search }
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate)
    if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate + 'T23:59:59.999Z')
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: where as any }),
    prisma.auditLog.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json(successResponseWithPagination(logs, { page, limit: pageSize, total }))
}
