import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse } from '@/lib/api-response'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'oem.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  const oldContract = await prisma.oEMContract.findUnique({ where: { id } })
  const contract = await prisma.oEMContract.update({ where: { id }, data: body })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status && body.status !== oldContract?.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'OEMContract',
    entityId: id,
    detail: { contractNo: contract.contractNo, oldStatus: oldContract?.status, newStatus: contract.status },
    ip,
  })

  return NextResponse.json(successResponse(contract))
}

// DELETE /api/supply/oem/[id] — 软删除代工合同
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'oem.delete', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const ip = extractIp(req)

  const contract = await prisma.oEMContract.findUnique({ where: { id } })
  if (!contract) return NextResponse.json({ error: '代工合同不存在' }, { status: 404 })

  await prisma.oEMContract.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'OEMContract',
    entityId: id,
    detail: { contractNo: contract.contractNo, productName: contract.productName },
    ip,
  })

  return NextResponse.json(successResponse(null))
}
