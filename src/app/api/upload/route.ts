// POST /api/upload — 文件上传（图片/PDF/Excel）
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// 共享上传目录：优先用环境变量，默认用 ~/clawd/data/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), '..', 'data', 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()
    if (!user) return errorResponse('未登录', 401)
    if (!await verifyPermission(user.role, 'file.upload', user.id)) {
      return errorResponse('权限不足', 403)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return errorResponse('请选择文件', 400)

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return errorResponse('不支持的文件格式', 400)
    }

    if (file.size > MAX_SIZE) {
      return errorResponse('文件不能超过 10MB', 400)
    }

    await mkdir(UPLOAD_DIR, { recursive: true })
    const ext = file.name.split('.').pop() || 'bin'
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(UPLOAD_DIR, uniqueName), buffer)

    return NextResponse.json(successResponse({ url: `/api/files/download/${uniqueName}`, name: uniqueName }))
  } catch (error) {
    console.error('上传失败:', error)
    return errorResponse('上传失败', 500)
  }
}
