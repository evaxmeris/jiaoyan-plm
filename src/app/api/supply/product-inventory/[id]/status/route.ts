import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse } from '@/lib/api-response'

// PATCH 手动修改批次状态（如标记过期/损坏）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'inventory.status', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params

  const batch = await prisma.productBatch.findUnique({ where: { id } })
  if (!batch || batch.isDeleted) {
    return NextResponse.json({ error: '批次不存在' }, { status: 404 })
  }

  let body: { status: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  if (!body.status) {
    return NextResponse.json({ error: 'status 不能为空' }, { status: 400 })
  }

  const validStatuses = ['IN_STOCK', 'USED', 'RETURNED', 'EXPIRED', 'OUT_OF_STOCK', 'DAMAGED']
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: `无效的状态值，可选值：${validStatuses.join(', ')}` }, { status: 400 })
  }

  const ip = extractIp(req)

  const item = await prisma.productBatch.update({
    where: { id },
    data: { status: body.status as any },
    include: { product: { select: { id: true, name: true, brand: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE_STATUS',
    entity: 'ProductBatch',
    entityId: id,
    detail: { batchNo: batch.batchNo, fromStatus: batch.status, toStatus: body.status },
    ip,
  })

  return NextResponse.json(successResponse(item))
}
