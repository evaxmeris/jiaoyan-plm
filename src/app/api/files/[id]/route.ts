import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

// PUT /api/files/[id] - 更新文件信息
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'file.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params

  const existing = await prisma.file.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return errorResponse('文件不存在', 404)
  }

  const body = await req.json()

  const file = await prisma.file.update({
    where: { id },
    data: {
      name: body.name !== undefined ? body.name : undefined,
      originalName: body.originalName !== undefined ? body.originalName : undefined,
      fileType: body.fileType !== undefined ? body.fileType : undefined,
      expireDate: body.expireDate !== undefined ? (body.expireDate ? new Date(body.expireDate) : null) : undefined,
      remark: body.remark !== undefined ? body.remark : undefined,
    },
  })

  const ip = extractIp(req)
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'File',
    entityId: id,
    detail: { name: file.originalName, changes: Object.keys(body) },
    ip,
  })

  return NextResponse.json(successResponse({ file }))
}
