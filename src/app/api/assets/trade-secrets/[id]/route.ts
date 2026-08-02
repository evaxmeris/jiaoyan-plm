// 技术秘密详情 API — GET / PUT / DELETE（软删除）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/assets/trade-secrets/[id] — 获取详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'trade_secret.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const secret = await prisma.tradeSecret.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true } } },
  })
  if (!secret || secret.isDeleted) {
    return errorResponse('技术秘密不存在', 404)
  }

  // Base64 解码
  const decodedContent = Buffer.from(secret.content, 'base64').toString('utf-8')

  return NextResponse.json(successResponse({ secret: { ...secret, content: decodedContent } }))
}

// PUT /api/assets/trade-secrets/[id] — 更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'trade_secret.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const existing = await prisma.tradeSecret.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return errorResponse('技术秘密不存在', 404)
  }

  const data: any = {}
  if (body.title !== undefined) data.title = body.title
  if (body.content !== undefined) data.content = Buffer.from(body.content, 'utf-8').toString('base64')
  if (body.summary !== undefined) data.summary = body.summary
  if (body.level !== undefined) data.level = body.level

  const secret = await prisma.tradeSecret.update({ where: { id }, data })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'TradeSecret',
    entityId: id,
    detail: { title: secret.title },
    ip,
  })

  const decodedContent = Buffer.from(secret.content, 'base64').toString('utf-8')
  return NextResponse.json(successResponse({ secret: { ...secret, content: decodedContent } }))
}

// DELETE /api/assets/trade-secrets/[id] — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'trade_secret.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.tradeSecret.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: '技术秘密不存在' }, { status: 404 })
  }

  await prisma.tradeSecret.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'TradeSecret',
    entityId: id,
    detail: { title: existing.title },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
