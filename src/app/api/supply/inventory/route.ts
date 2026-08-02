import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { RawMaterialBatchSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'
// GET /api/supply/inventory — 获取库存列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'inventory.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const materialId = searchParams.get('materialId')
  const q = searchParams.get('q') || ''

  const where: any = { status: 'IN_STOCK' }
  if (materialId) where.rawMaterialId = materialId
  if (q) where.OR = [
    { internalBatch: { contains: q } },
    { batchNo: { contains: q } },
    { supplier: { contains: q } },
  ]

  const items = await prisma.rawMaterialBatch.findMany({
    where,
    include: { rawMaterial: { select: { nameCn: true, unit: true } } },
    orderBy: { receiptDate: 'desc' },
  })
  return NextResponse.json(successResponse(items))
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  if (!await verifyPermission(user.role, 'inventory.create', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const validated = await validateBody(req, RawMaterialBatchSchema.passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)
  const internalBatch = `JY-RM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 999)).padStart(3,'0')}`

  const item = await prisma.rawMaterialBatch.create({
    data: {
      rawMaterialId: body.rawMaterialId,
      batchNo: body.batchNo,
      internalBatch,
      quantity: body.quantity || 0,
      receiptDate: new Date(body.receiptDate),
      supplier: body.supplier || '',
      coaUrl: body.coaUrl || null,
      remark: body.remark || null,
    },
    include: { rawMaterial: { select: { nameCn: true } } },
  })

  // 更新原料库存数量
  await prisma.rawMaterial.update({
    where: { id: body.rawMaterialId },
    data: { currentStock: { increment: body.quantity || 0 } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'RawMaterialBatch',
    entityId: item.id,
    detail: { rawMaterialId: body.rawMaterialId, quantity: body.quantity, internalBatch },
    ip,
  })

  return NextResponse.json(successResponse(item), { status: 201 })
}
