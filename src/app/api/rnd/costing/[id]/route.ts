// 成本核算详情 GET/PUT/DELETE
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/costing/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'costing.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const costing = await prisma.productCosting.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })
  if (!costing) return NextResponse.json({ error: '成本核算不存在' }, { status: 404 })

  // 同时返回该产品的价格历史
  const priceHistory = await prisma.priceHistory.findMany({
    where: { productDesignId: costing.productDesignId },
    orderBy: { effectiveDate: 'desc' },
  })

  return NextResponse.json(successResponse({ costing, priceHistory }))
}

// PUT /api/rnd/costing/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'costing.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const old = await prisma.productCosting.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '成本核算不存在' }, { status: 404 })

  // 解析数值
  const rawMaterialCost = body.rawMaterialCost !== undefined ? parseFloat(body.rawMaterialCost) : old.rawMaterialCost
  const packagingCost = body.packagingCost !== undefined ? parseFloat(body.packagingCost) : old.packagingCost
  const oemFee = body.oemFee !== undefined ? parseFloat(body.oemFee) : old.oemFee
  const testingFee = body.testingFee !== undefined ? parseFloat(body.testingFee) : old.testingFee
  const certificationFee = body.certificationFee !== undefined ? parseFloat(body.certificationFee) : old.certificationFee
  const otherCost = body.otherCost !== undefined ? parseFloat(body.otherCost) : old.otherCost
  const outputQty = body.outputQty !== undefined ? parseInt(body.outputQty) : old.outputQty
  const targetMargin = body.targetMargin !== undefined
    ? (body.targetMargin !== '' ? parseFloat(body.targetMargin) : null)
    : old.targetMargin

  // 自动计算总成本和单件成本
  const totalCost = rawMaterialCost + packagingCost + oemFee + testingFee + certificationFee + otherCost
  const unitCost = outputQty > 0 ? totalCost / outputQty : 0

  // 建议零售价
  let suggestedPrice = old.suggestedPrice
  if (body.targetMargin !== undefined) {
    if (targetMargin !== null && targetMargin > 0 && targetMargin < 100) {
      suggestedPrice = unitCost / (1 - targetMargin / 100)
    } else if (targetMargin !== null && targetMargin >= 100) {
      suggestedPrice = unitCost * (1 + targetMargin / 100)
    } else {
      suggestedPrice = unitCost
    }
  } else if (rawMaterialCost !== old.rawMaterialCost || outputQty !== old.outputQty) {
    // 成本变化且未改倍率时重新计算
    if (old.targetMargin !== null && old.targetMargin > 0 && old.targetMargin < 100) {
      suggestedPrice = unitCost / (1 - old.targetMargin / 100)
    } else {
      suggestedPrice = unitCost
    }
  }

  const costing = await prisma.productCosting.update({
    where: { id },
    data: {
      costingDate: body.costingDate ? new Date(body.costingDate) : undefined,
      rawMaterialCost,
      packagingCost,
      oemFee,
      testingFee,
      certificationFee,
      otherCost,
      totalCost,
      outputQty,
      unitCost,
      targetMargin,
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
      actualPrice: body.actualPrice !== undefined
        ? (body.actualPrice !== '' ? parseFloat(body.actualPrice) : null)
        : undefined,
      status: body.status ?? undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'ProductCosting',
    entityId: id,
    detail: { oldStatus: old.status, newStatus: costing.status, version: costing.version },
    ip,
  })

  return NextResponse.json(successResponse(costing))
}

// DELETE /api/rnd/costing/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'costing.delete', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const ip = extractIp(req)

  const old = await prisma.productCosting.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: '成本核算不存在' }, { status: 404 })

  await prisma.productCosting.delete({ where: { id } })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'ProductCosting',
    entityId: id,
    detail: { productDesignId: old.productDesignId, version: old.version },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
