// 稳定性跟踪详情 GET/PUT/DELETE
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/stability-tests/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'stability.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const test = await prisma.stabilityTest.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })
  if (!test) return errorResponse('稳定性测试不存在', 404)

  return NextResponse.json(successResponse({ test }))
}

// PUT /api/rnd/stability-tests/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'stability.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const old = await prisma.stabilityTest.findUnique({ where: { id } })
  if (!old) return errorResponse('稳定性测试不存在', 404)

  const test = await prisma.stabilityTest.update({
    where: { id },
    data: {
      batchNo: body.batchNo ?? undefined,
      testType: body.testType ?? undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      interval: body.interval !== undefined ? parseInt(body.interval) : undefined,
      status: body.status ?? undefined,
      records: body.records ?? undefined,
      remark: body.remark ?? undefined,
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'StabilityTest',
    entityId: id,
    detail: { oldStatus: old.status, newStatus: test.status },
    ip,
  })

  return NextResponse.json(successResponse({ test }))
}

// DELETE /api/rnd/stability-tests/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'stability.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  await prisma.stabilityTest.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'StabilityTest',
    entityId: id,
    ip,
  })

  return NextResponse.json({ ok: true })
}
