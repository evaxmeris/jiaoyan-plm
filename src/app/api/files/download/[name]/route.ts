// GET /api/files/[name] — 提供上传的文件（绕开 Next.js 静态目录限制）
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { errorResponse } from '@/lib/api-response'

// 共享上传目录：优先用环境变量，默认用 ~/clawd/data/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), '..', 'data', 'uploads')
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.webp']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await verifyAuth()
    if (!user) return errorResponse('未登录', 401)
    if (!await verifyPermission(user.role, 'file.view', user.id)) {
      return errorResponse('权限不足', 403)
    }

    const { name } = await params
    // 安全检查：防止路径穿越
    const safe = path.basename(name)
    const ext = path.extname(safe).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return errorResponse('不支持的文件类型', 400)
    }
    const filePath = path.join(UPLOAD_DIR, safe)
    const buffer = await readFile(filePath)

    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safe}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return errorResponse('文件不存在', 404)
  }
}
