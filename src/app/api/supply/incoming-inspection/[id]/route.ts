import { createDetailHandlers } from '@/lib/crud-factory'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'

const base = createDetailHandlers({
  model: 'incomingInspection',
  permissions: { view: 'incoming-inspection.view', create: 'incoming-inspection.create', update: 'incoming-inspection.update', delete: 'incoming-inspection.delete' },
  include: {
    rawMaterial: { select: { nameCn: true, unit: true } },
    batch: { select: { batchNo: true, internalBatch: true } },
  },
})

export const { GET, DELETE } = base

const INCLUDE = {
  rawMaterial: { select: { nameCn: true, unit: true } },
  batch: { select: { batchNo: true, internalBatch: true } },
}

async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'incoming-inspection.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const old = await (prisma as any).incomingInspection.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { body = {} }

  const record = await (prisma as any).incomingInspection.update({ where: { id }, data: body, include: INCLUDE })

  // 审计日志（更新）
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'incomingInspection',
    entityId: id,
    detail: { changes: Object.keys(body).slice(0, 10) },
    ip: extractIp(req),
  })

  // NCR + 批次状态联动：来料检验结果影响批次和库存
  if (old.result !== body.result) {
    if (body.result === 'PASS') {
      try {
        // 批次状态 → IN_STOCK，增加库存
        if (old.batchId) {
          await (prisma as any).rawMaterialBatch.update({
            where: { id: old.batchId },
            data: { status: 'IN_STOCK' },
          })
        }
        if (old.rawMaterialId && old.batchId) {
          const batch = await (prisma as any).rawMaterialBatch.findUnique({ where: { id: old.batchId } })
          if (batch) {
            await (prisma as any).rawMaterial.update({
              where: { id: old.rawMaterialId },
              data: { currentStock: { increment: batch.quantity } },
            })
          }
        }
      } catch (e) {
        console.error('[IQC_PASS] 批次入库失败:', e)
      }
    } else if (body.result === 'FAIL') {
      try {
        // 批次状态 → RETURNED，不增库存
        if (old.batchId) {
          await (prisma as any).rawMaterialBatch.update({
            where: { id: old.batchId },
            data: { status: 'RETURNED' },
          })
        }

        // NCR_AUTO: 来料检验失败 → 自动建议处置
        await writeAuditLog({
          userId: user.id,
          userName: user.name,
          action: 'NCR_AUTO',
          entity: 'IncomingInspection',
          entityId: id,
          detail: {
            result: 'FAIL',
            rawMaterialId: old.rawMaterialId,
            batchId: old.batchId,
            autoDisposition: '退回供应商',
          },
          ip: extractIp(req),
        })
      } catch (e) {
        console.error('[IQC_FAIL] 批次退回失败:', e)
      }
    }
  }

  return NextResponse.json({ incomingInspection: record })
}

export { PUT }
