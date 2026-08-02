import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/assets/patents/[id]/fees — 获取专利年费列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  const { id } = await params

  // 验证专利存在
  const patent = await prisma.patent.findUnique({ where: { id, isDeleted: false } })
  if (!patent) return errorResponse('专利不存在', 404)

  const fees = await prisma.patentFee.findMany({
    where: { patentId: id },
    orderBy: { year: 'desc' },
  })

  return NextResponse.json(successResponse({ fees }))
}

// POST /api/assets/patents/[id]/fees — 添加年费记录
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'patent.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 验证专利存在
  const patent = await prisma.patent.findFirst({ where: { id, isDeleted: false } })
  if (!patent) return errorResponse('专利不存在', 404)

  const fee = await prisma.patentFee.create({
    data: {
      patentId: id,
      year: body.year,
      amount: body.amount,
      dueDate: new Date(body.dueDate),
      paidDate: body.paidDate ? new Date(body.paidDate) : null,
      status: body.status || 'PENDING',
      remark: body.remark || null,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PatentFee',
    entityId: fee.id,
    detail: { patentId: id, year: fee.year, amount: fee.amount, status: fee.status },
    ip,
  })

  return NextResponse.json(successResponse({ fee }), { status: 201 })
}

// PUT /api/assets/patents/[id]/fees — 更新年费（query param ?feeId=xxx）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'patent.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const feeId = searchParams.get('feeId')
  if (!feeId) return errorResponse('缺少 feeId 参数', 400)

  const body = await req.json()
  const ip = extractIp(req)

  const fee = await prisma.patentFee.update({
    where: { id: feeId },
    data: {
      amount: body.amount !== undefined ? body.amount : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      paidDate: body.paidDate ? new Date(body.paidDate) : body.paidDate === null ? null : undefined,
      status: body.status || undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'PatentFee',
    entityId: fee.id,
    detail: { patentId: id, year: fee.year, amount: fee.amount, status: fee.status },
    ip,
  })

  return NextResponse.json(successResponse({ fee }))
}
