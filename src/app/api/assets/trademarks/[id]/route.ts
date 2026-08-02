import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { createDetailHandlers } from '@/lib/crud-factory'

// ── 工厂配置 ──
const FACTORY_CONFIG = {
  model: 'trademark' as const,
  permissions: {
    view: 'trademark.view',
    create: 'trademark.create',
    update: 'trademark.update',
    delete: 'trademark.delete',
  },
  detailInclude: {
    productLinks: {
      include: {
        product: { select: { id: true, name: true, brand: true, category: true, status: true } },
      },
    },
  },
  orderBy: { updatedAt: 'desc' as const },
  softDeleteField: 'isDeleted',
  searchFields: ['name', 'applicationNo', 'registrationNo', 'owner'],
}

const { PUT: factoryPut, DELETE: factoryDelete } = createDetailHandlers(FACTORY_CONFIG)

// GET /api/assets/trademarks/[id] — 获取商标详情（含关联的审计日志和审批请求）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'trademark.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params

  const trademark = await prisma.trademark.findFirst({
    where: { id, isDeleted: false },
    include: FACTORY_CONFIG.detailInclude,
  })

  if (!trademark) return NextResponse.json({ error: '商标不存在' }, { status: 404 })

  // 获取关联的审计日志
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: 'Trademark', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // 获取关联的审批请求（使用通用审批模型）
  const approvalRequests = await prisma.approvalRequest.findMany({
    where: { entityType: 'Trademark', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ trademark, auditLogs, approvalRequests })
}

// PUT/DELETE 使用工厂
export { factoryPut as PUT, factoryDelete as DELETE }
