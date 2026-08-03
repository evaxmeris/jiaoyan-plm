// GET /api/files/download?id=xxx — 提供上传的文件（绕开 Next.js 静态目录限制）
// 支持两种定位方式：
//   1. ?id=xxx：按数据库文件 id 定位（推荐，URL 纯 ASCII，兼容中文文件名）
//   2. /api/files/download/[name]：按文件名定位（旧 URL 兼容，含中文名时 Next.js 参数解码可能异常）
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { errorResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

// 共享上传目录：优先用环境变量，默认用 ~/clawd/data/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), '..', 'data', 'uploads')
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await verifyAuth()
    if (!user) return errorResponse('未登录', 401)
    if (!await verifyPermission(user.role, 'file.view', user.id)) {
      return errorResponse('权限不足', 403)
    }

    // 路径段优先按文件 id 定位（DB 文件名与实际磁盘文件一一对应，无编码歧义）
    // 前端统一使用 /api/files/download/<fileId> 形式；旧数据中的 /api/files/download/<fileName> 继续兼容
    const { name } = await params
    let fileName = ''
    const byId = await prisma.file.findUnique({ where: { id: name } })
    if (byId && !byId.isDeleted) {
      fileName = byId.name
    } else {
      try {
        fileName = decodeURIComponent(name)
      } catch {
        fileName = name
      }
    }

    // 安全检查：防止路径穿越
    const safe = path.basename(fileName)
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

    // 文件名以 RFC 5987 编码放入 Content-Disposition，避免中文文件名乱码/截断
    const encodedName = encodeURIComponent(safe)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return errorResponse('文件不存在', 404)
  }
}
