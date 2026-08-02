import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/logistics/addresses — 收货地址列表
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping_address.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const addresses = await prisma.shippingAddress.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(successResponse(addresses))
}

// POST /api/logistics/addresses — 创建收货地址
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping_address.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.label || !body.receiver || !body.phone || !body.province || !body.city || !body.district || !body.detail) {
    return errorResponse('请填写完整的地址信息', 400)
  }

  // 如果设为默认，先取消其他默认
  if (body.isDefault) {
    await prisma.shippingAddress.updateMany({ data: { isDefault: false } })
  }

  const address = await prisma.shippingAddress.create({
    data: {
      label: body.label,
      receiver: body.receiver,
      phone: body.phone,
      province: body.province,
      city: body.city,
      district: body.district,
      detail: body.detail,
      isDefault: body.isDefault || false,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ShippingAddress',
    entityId: address.id,
    detail: { label: address.label, receiver: address.receiver },
    ip,
  })

  return NextResponse.json(successResponse(address), { status: 201 })
}

// PUT /api/logistics/addresses — 更新收货地址（通过 body.id）
export async function PUT(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping_address.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  if (!body.id) {
    return errorResponse('缺少地址ID', 400)
  }

  const existing = await prisma.shippingAddress.findUnique({ where: { id: body.id } })
  if (!existing) return errorResponse('收货地址不存在', 404)

  // 如果设为默认，先取消其他默认
  if (body.isDefault) {
    await prisma.shippingAddress.updateMany({ data: { isDefault: false } })
  }

  const updated = await prisma.shippingAddress.update({
    where: { id: body.id },
    data: {
      label: body.label ?? undefined,
      receiver: body.receiver ?? undefined,
      phone: body.phone ?? undefined,
      province: body.province ?? undefined,
      city: body.city ?? undefined,
      district: body.district ?? undefined,
      detail: body.detail ?? undefined,
      isDefault: body.isDefault !== undefined ? body.isDefault : undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ShippingAddress',
    entityId: body.id,
    detail: { label: existing.label },
    ip,
  })

  return NextResponse.json(successResponse(updated))
}

// DELETE /api/logistics/addresses — 删除收货地址
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'shipping_address.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return errorResponse('缺少地址ID', 400)

  const ip = extractIp(req)

  const address = await prisma.shippingAddress.findUnique({ where: { id } })
  if (!address) return errorResponse('收货地址不存在', 404)

  await prisma.shippingAddress.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ShippingAddress',
    entityId: id,
    detail: { label: address.label },
    ip,
  })

  return NextResponse.json(successResponse({ deleted: true }))
}
