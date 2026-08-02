// 技术秘密 CRUD API
// 技术秘密内容使用 Base64 编码存储
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/assets/trade-secrets — 获取技术秘密列表（仅CEO）
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'trade_secret.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const secrets = await prisma.tradeSecret.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      summary: true,
      level: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse(secrets))
}

// POST /api/assets/trade-secrets — 创建技术秘密
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'trade_secret.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const ip = extractIp(req)

  // Base64 编码内容
  const content = Buffer.from(body.content || '', 'utf-8').toString('base64')

  const secret = await prisma.tradeSecret.create({
    data: {
      title: body.title,
      content,
      summary: body.summary || body.title,
      level: body.level || 'CONFIDENTIAL',
      createdBy: user.id,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'TradeSecret',
    entityId: secret.id,
    detail: { title: secret.title, level: secret.level },
    ip,
  })

  return NextResponse.json(successResponse({ secret: { ...secret, content: body.content } }), { status: 201 })
}
