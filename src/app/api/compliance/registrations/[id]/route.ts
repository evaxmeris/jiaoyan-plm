import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/compliance/registrations/[id] — 获取单条备案详情（含关联数据）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration.detail', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const registration = await prisma.registration.findUnique({
    where: { id, isDeleted: false },
    include: {
      product: {
        select: { id: true, name: true, brand: true, category: true, capacity: true, status: true },
      },
      testEntrustments: {
        where: { isDeleted: false },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  if (!registration) {
    return errorResponse('备案记录不存在', 404)
  }

  return NextResponse.json(successResponse({ registration }))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 获取旧记录
  const oldReg = await prisma.registration.findUnique({ where: { id } })
  if (!oldReg) return errorResponse('备案记录不存在', 404)

  const reg = await prisma.registration.update({
    where: { id },
    data: {
      registerNo: body.registerNo ?? undefined,
      registerType: body.registerType ?? undefined,
      applyDate: body.applyDate ? new Date(body.applyDate) : undefined,
      approveDate: body.approveDate ? new Date(body.approveDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      status: body.status ?? undefined,
      remark: body.remark ?? undefined,
    },
  })

  // 备案状态变更→产品状态自动联动
  // 状态映射：备案状态 → 产品状态
  const STATUS_PRODUCT_MAP: Record<string, string> = {
    REGISTERED: 'REGISTERED',
    EXEMPTED: 'REGISTERED',
    REJECTED: 'DESIGNING',
    UNDER_REVIEW: 'REGISTERING',
  }
  if (reg.status !== oldReg.status && reg.productId) {
    try {
      const targetProductStatus = STATUS_PRODUCT_MAP[reg.status]
      if (targetProductStatus) {
        await prisma.productDesign.update({
          where: { id: reg.productId },
          data: { status: targetProductStatus as any },
        })
      }
    } catch (e) {
      console.error('[auto-link] 备案→产品状态联动失败:', e)
    }
  }

  // 写入审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status !== oldReg.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'Registration',
    entityId: id,
    detail: {
      oldStatus: oldReg.status,
      newStatus: reg.status,
      productId: reg.productId,
      registerNo: reg.registerNo,
      autoUpdatedProduct: STATUS_PRODUCT_MAP[reg.status] ?? null,
    },
    ip,
  })

  return NextResponse.json(successResponse({ registration: reg }))
}

// DELETE /api/compliance/registrations/[id] — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'registration.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.registration.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return errorResponse('备案记录不存在', 404)
  }

  await prisma.registration.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'Registration',
    entityId: id,
    detail: { registerNo: existing.registerNo, registerType: existing.registerType },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
