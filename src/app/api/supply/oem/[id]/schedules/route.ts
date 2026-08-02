import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'oem.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const schedules = await prisma.oemSchedule.findMany({
    where: { contractId: id },
    orderBy: { plannedDate: 'desc' },
  })
  return NextResponse.json(successResponse(schedules))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'oem.create', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()

  // 验证合同存在
  const contract = await prisma.oEMContract.findUnique({ where: { id } })
  if (!contract) return errorResponse('合同不存在', 404)

  const schedule = await prisma.oemSchedule.create({
    data: {
      contractId: id,
      productName: body.productName,
      orderQty: parseInt(body.orderQty) || 0,
      plannedDate: new Date(body.plannedDate),
      completedDate: body.completedDate ? new Date(body.completedDate) : null,
      status: body.status || 'PLANNED',
      remark: body.remark || null,
    },
  })
  return NextResponse.json(successResponse(schedule), { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'oem.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { scheduleId, ...data } = body

  if (!scheduleId) return errorResponse('缺少 scheduleId', 400)

  const updateData: any = {}
  if (data.productName) updateData.productName = data.productName
  if (data.orderQty) updateData.orderQty = parseInt(data.orderQty)
  if (data.plannedDate) updateData.plannedDate = new Date(data.plannedDate)
  if (data.completedDate) updateData.completedDate = new Date(data.completedDate)
  if (data.status) updateData.status = data.status
  if (data.remark !== undefined) updateData.remark = data.remark

  const schedule = await prisma.oemSchedule.update({
    where: { id: scheduleId },
    data: updateData,
  })
  return NextResponse.json(successResponse(schedule))
}
