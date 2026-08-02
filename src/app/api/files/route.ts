import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { successResponse, errorResponse } from '@/lib/api-response'

// 允许的 MIME 类型
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// GET /api/files?entityType=xxx&entityId=xxx - 按实体查询文件列表
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'file.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  const where: Record<string, unknown> = { isDeleted: false }
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(successResponse({ files }))
}

// POST /api/files - 上传文件
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'file.upload', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const contentType = req.headers.get('content-type') || ''

  // JSON 请求：直接存储文件元信息（外部 URL）
  if (contentType.includes('application/json')) {
    const body = await req.json()

    if (!body.name || !body.url || !body.entityType || !body.entityId) {
      return errorResponse('缺少必填字段: name, url, entityType, entityId', 400)
    }

    const file = await prisma.file.create({
      data: {
        name: body.name,
        originalName: body.originalName || body.name,
        url: body.url,
        mimeType: body.mimeType || 'application/octet-stream',
        size: body.size || 0,
        entityType: body.entityType,
        entityId: body.entityId,
        fileType: body.fileType || null,
        expireDate: body.expireDate ? new Date(body.expireDate) : null,
        uploadedBy: user.name,
        remark: body.remark || null,
      },
    })

    const ip = extractIp(req)
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'CREATE',
      entity: 'File',
      entityId: file.id,
      detail: { name: file.originalName, entityType: file.entityType, entityId: file.entityId },
      ip,
    })

    return NextResponse.json(successResponse({ file }), { status: 201 })
  }

  // FormData 请求：接收文件并存储到本地 uploads 目录
  const formData = await req.formData()
  const uploadedFile = formData.get('file') as File | null
  if (!uploadedFile) {
    return errorResponse('缺少文件字段 (file)', 400)
  }

  const entityType = formData.get('entityType') as string
  const entityId = formData.get('entityId') as string
  const fileType = (formData.get('fileType') as string) || null
  const remark = (formData.get('remark') as string) || null

  if (!entityType || !entityId) {
    return errorResponse('缺少必填字段: entityType, entityId', 400)
  }

  // MIME 类型校验
  if (!ALLOWED_MIME_TYPES.includes(uploadedFile.type)) {
    return errorResponse(`不支持的文件类型: ${uploadedFile.type}`, 400)
  }

  // 文件大小校验
  if (uploadedFile.size > MAX_FILE_SIZE) {
    return errorResponse('文件大小超过限制 (20MB)', 400)
  }

  // 确保上传目录存在
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', entityType, entityId)
  await mkdir(uploadDir, { recursive: true })

  // 生成唯一文件名
  const timestamp = Date.now()
  const safeName = uploadedFile.name.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const fileName = `${timestamp}-${safeName}`
  const filePath = path.join(uploadDir, fileName)

  // 写入文件
  const buffer = Buffer.from(await uploadedFile.arrayBuffer())
  await writeFile(filePath, buffer)

  const publicUrl = `/uploads/${entityType}/${entityId}/${fileName}`

  const file = await prisma.file.create({
    data: {
      name: fileName,
      originalName: uploadedFile.name,
      url: publicUrl,
      mimeType: uploadedFile.type,
      size: uploadedFile.size,
      entityType,
      entityId,
      fileType,
      uploadedBy: user.name,
      remark,
    },
  })

  const ip = extractIp(req)
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'File',
    entityId: file.id,
    detail: { name: file.originalName, entityType, entityId, size: uploadedFile.size },
    ip,
  })

  return NextResponse.json(successResponse({ file }), { status: 201 })
}

// DELETE /api/files?id=xxx - 软删除文件
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'file.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return errorResponse('缺少参数: id', 400)

  const existing = await prisma.file.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return errorResponse('文件不存在', 404)
  }

  // 软删除
  const file = await prisma.file.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  const ip = extractIp(req)
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'File',
    entityId: id,
    detail: { name: existing.originalName },
    ip,
  })

  return NextResponse.json(successResponse({ file }))
}
