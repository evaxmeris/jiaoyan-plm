import { createDetailHandlers } from '@/lib/crud-factory'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'

const base = createDetailHandlers({
  model: 'oQC',
  permissions: { view: 'oqc.view', create: 'oqc.create', update: 'oqc.update', delete: 'oqc.delete' },
  include: {
    product: { select: { name: true, brand: true } },
  },
})

export const { GET, DELETE } = base

const INCLUDE = {
  product: { select: { name: true, brand: true } },
}

async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'oqc.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const old = await (prisma as any).oQC.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { body = {} }

  const record = await (prisma as any).oQC.update({ where: { id }, data: body, include: INCLUDE })

  // 审计日志（更新）
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'oQC',
    entityId: id,
    detail: { changes: Object.keys(body).slice(0, 10) },
    ip: extractIp(req),
  })

  // NCR_AUTO: 出厂检验失败 → 自动建议处置
  if (old.result !== 'FAIL' && body.result === 'FAIL') {
    try {
      await writeAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'NCR_AUTO',
        entity: 'OQC',
        entityId: id,
        detail: {
          result: 'FAIL',
          batchNo: old.batchNo,
          autoDisposition: '报废',
        },
        ip: extractIp(req),
      })
    } catch (e) {
      console.error('[NCR_AUTO] OQC 自动处置记录失败:', e)
    }
  }

  return NextResponse.json({ oQC: record })
}

export { PUT }
