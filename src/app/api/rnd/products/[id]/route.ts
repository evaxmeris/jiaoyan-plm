// 产品详情 GET/PUT — 支持编辑产品字段及包材BOM
// 包含产品状态机校验（生命周期状态转换规则）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { ProductDesignSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// 产品状态顺序定义（索引越大越靠后）
const STATUS_ORDER: Record<string, number> = {
  CONCEPT: 0,
  DESIGNING: 1,
  SAMPLING: 2,
  TESTING: 3,
  REGISTERING: 4,
  READY: 5,
  LAUNCHED: 6,
  DISCONTINUED: 7,
}

// 获取某个状态所有允许的下一个状态
function getAllowedNextStatuses(currentStatus: string): string[] {
  const allowed: string[] = []
  const currentIdx = STATUS_ORDER[currentStatus]

  if (currentIdx === undefined) return allowed

  // DISCONTINUED 是终态，不允许任何后续转换
  if (currentStatus === 'DISCONTINUED') return allowed

  // 任何状态都可以转为 DISCONTINUED
  allowed.push('DISCONTINUED')

  // 正常前进：只能到下一个状态
  const nextIdx = currentIdx + 1
  const nextStatus = Object.entries(STATUS_ORDER).find(
    ([, idx]) => idx === nextIdx
  )?.[0]
  if (nextStatus) {
    allowed.push(nextStatus)
  }

  return allowed
}

// 校验状态转换是否合法，返回 { valid, allowedNext, error? }
async function validateStatusTransition(
  productId: string,
  currentStatus: string,
  newStatus: string
): Promise<{ valid: boolean; allowedNext: string[]; error?: string }> {
  const allowedNext = getAllowedNextStatuses(currentStatus)

  // 如果状态没变，允许
  if (currentStatus === newStatus) {
    return { valid: true, allowedNext }
  }

  // 检查是否在允许列表中
  if (!allowedNext.includes(newStatus)) {
    return {
      valid: false,
      allowedNext,
      error: `不允许的状态转换：${currentStatus} → ${newStatus}。允许的下一个状态：${allowedNext.join('、')}`,
    }
  }

  // 特殊规则校验
  // SAMPLING → TESTING：必须先有至少一个检测项
  if (currentStatus === 'SAMPLING' && newStatus === 'TESTING') {
    const inspectionCount = await prisma.testEntrustment.count({
      where: { productDesignId: productId },
    })
    if (inspectionCount === 0) {
      return {
        valid: false,
        allowedNext,
        error: '无法转为"检测中"：请先创建至少一项检测记录',
      }
    }
  }

  // TESTING → REGISTERING：全部检测必须 PASS
  if (currentStatus === 'TESTING' && newStatus === 'REGISTERING') {
    const inspections = await prisma.testEntrustment.findMany({
      where: { productDesignId: productId },
    })
    const pendingOrFail = inspections.filter(
      (i) => i.result !== 'PASS'
    )
    if (pendingOrFail.length > 0) {
      return {
        valid: false,
        allowedNext,
        error: `无法转为"备案中"：尚有 ${pendingOrFail.length} 项检测未通过（含待出和不通过）`,
      }
    }
  }

  // REGISTERING → READY：必须先有至少一个 REGISTERED 备案
  if (currentStatus === 'REGISTERING' && newStatus === 'READY') {
    const registeredCount = await prisma.registration.count({
      where: {
        productId,
        status: 'REGISTERED',
      },
    })
    if (registeredCount === 0) {
      return {
        valid: false,
        allowedNext,
        error: '无法转为"可量产"：请先完成药监局备案（获得 REGISTERED 状态的备案记录）',
      }
    }
  }

  return { valid: true, allowedNext }
}

// GET /api/rnd/products/[id] — 获取单个产品详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'product.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const product = await prisma.productDesign.findUnique({
    where: { id },
    include: { formula: true },
  })
  if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  return NextResponse.json(successResponse(product))
}

// PUT /api/rnd/products/[id] — 更新产品（含包材BOM + 状态机校验）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'product.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const validated = await validateBody(req, ProductDesignSchema.partial().passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  // 获取旧数据用于审计日志
  const existing = await prisma.productDesign.findUnique({
    where: { id },
  })
  if (!existing) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  // 如果请求中包含 status，执行状态机校验
  if (body.status) {
    const validation = await validateStatusTransition(
      id,
      existing.status,
      body.status
    )

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error,
          allowedNext: validation.allowedNext,
          currentStatus: existing.status,
        },
        { status: 400 }
      )
    }
  }

  const product = await prisma.productDesign.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      brand: body.brand ?? undefined,
      category: body.category ?? undefined,
      capacity: body.capacity ?? undefined,
      status: body.status ?? undefined,
      formulaId: body.formulaId ?? undefined,
      packagingBom: body.packagingBom !== undefined ? body.packagingBom : undefined,
      designDoc: body.designDoc ?? undefined,
      remark: body.remark ?? undefined,
    },
    include: { formula: true },
  })

  // 写入审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status && body.status !== existing.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'ProductDesign',
    entityId: id,
    detail: {
      oldStatus: existing.status,
      newStatus: product.status,
      nameChanged: body.name !== undefined && body.name !== existing.name,
    },
    ip,
  })

  return NextResponse.json(successResponse(product))
}

// DELETE /api/rnd/products/[id] — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'product.delete', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const ip = extractIp(req)
  await prisma.productDesign.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ProductDesign',
    entityId: id,
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
