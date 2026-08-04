import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { createDetailHandlers } from '@/lib/crud-factory'

const { GET, DELETE } = createDetailHandlers({
  model: 'rawMaterial',
  permissions: { view: 'material.view', create: 'material.create', update: 'material.update', delete: 'material.delete' },
  softDeleteField: 'isDeleted',
})

export { GET, DELETE }

// 自定义 PUT：手输 latestPrice 变更时，旧价自动沉淀到价格历史（新价成为当前价）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'material.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const old = await prisma.rawMaterial.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { body = {} }

  try {
    // 价格变更 → 旧价写历史（手输新价覆盖，旧价沉淀，符合「价格以最新为准」）
    const newPrice = body.latestPrice !== undefined && body.latestPrice !== null ? Number(body.latestPrice) : null
    if (newPrice !== null && old.latestPrice !== null && old.latestPrice !== newPrice) {
      await prisma.rawMaterialPrice.create({
        data: {
          rawMaterialId: id,
          price: old.latestPrice,
          unit: body.unit || old.unit || 'kg',
          supplier: body.supplier || old.supplier || null,
          remark: `手动调整：¥${old.latestPrice} → ¥${newPrice}`,
          recordedAt: new Date(),
        },
      })
    }

    const record = await prisma.rawMaterial.update({ where: { id }, data: body })

    const { writeAuditLog, extractIp } = await import('@/lib/audit')
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'UPDATE',
      entity: 'rawMaterial',
      entityId: id,
      detail: { changes: Object.keys(body).slice(0, 10) },
      ip: extractIp(req),
    })

    return NextResponse.json({ success: true, data: record, rawMaterial: record })
  } catch (err: any) {
    const msg = err?.message || '更新失败'
    const isValidation = msg.includes('Invalid option') || msg.includes('不能为空') || msg.includes('Invalid') || msg.includes('expected')
    return NextResponse.json({ success: false, error: msg }, { status: isValidation ? 400 : 500 })
  }
}
