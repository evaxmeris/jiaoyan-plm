// 产品合规认证 API — 支持 CRUD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/products/[id]/certifications — 获取产品的所有合规认证
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const certifications = await prisma.productCertification.findMany({
    where: { productDesignId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ certifications }))
}

// POST /api/rnd/products/[id]/certifications — 添加合规认证
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 验证产品存在
  const product = await prisma.productDesign.findUnique({ where: { id } })
  if (!product) return errorResponse('产品不存在', 404)

  const certification = await prisma.productCertification.create({
    data: {
      productDesignId: id,
      market: body.market,
      certType: body.certType,
      certName: body.certName,
      certNo: body.certNo || null,
      status: body.status || 'PENDING',
      applyDate: body.applyDate ? new Date(body.applyDate) : null,
      approveDate: body.approveDate ? new Date(body.approveDate) : null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'ProductCertification',
    entityId: certification.id,
    detail: { productDesignId: id, certName: certification.certName, market: certification.market },
    ip,
  })

  return NextResponse.json(successResponse({ certification }), { status: 201 })
}

// PUT /api/rnd/products/[id]/certifications — 更新认证（通过 query param certId）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const certId = searchParams.get('certId')
  if (!certId) return errorResponse('缺少 certId 参数', 400)

  const body = await req.json()
  const ip = extractIp(req)

  // 验证认证属于该产品
  const existing = await prisma.productCertification.findFirst({
    where: { id: certId, productDesignId: id },
  })
  if (!existing) return errorResponse('认证记录不存在', 404)

  const certification = await prisma.productCertification.update({
    where: { id: certId },
    data: {
      market: body.market ?? undefined,
      certType: body.certType ?? undefined,
      certName: body.certName ?? undefined,
      certNo: body.certNo ?? undefined,
      status: body.status ?? undefined,
      applyDate: body.applyDate !== undefined ? (body.applyDate ? new Date(body.applyDate) : null) : undefined,
      approveDate: body.approveDate !== undefined ? (body.approveDate ? new Date(body.approveDate) : null) : undefined,
      expiryDate: body.expiryDate !== undefined ? (body.expiryDate ? new Date(body.expiryDate) : null) : undefined,
      remark: body.remark ?? undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ProductCertification',
    entityId: certId,
    detail: { productDesignId: id, changes: body },
    ip,
  })

  return NextResponse.json(successResponse({ certification }))
}

// DELETE /api/rnd/products/[id]/certifications — 删除认证（通过 query param certId）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'registration.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const certId = searchParams.get('certId')
  if (!certId) return errorResponse('缺少 certId 参数', 400)

  const existing = await prisma.productCertification.findFirst({
    where: { id: certId, productDesignId: id },
  })
  if (!existing) return errorResponse('认证记录不存在', 404)

  const ip = extractIp(req)
  await prisma.productCertification.delete({ where: { id: certId } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ProductCertification',
    entityId: certId,
    detail: { productDesignId: id, certName: existing.certName },
    ip,
  })

  return NextResponse.json(successResponse(null))
}
