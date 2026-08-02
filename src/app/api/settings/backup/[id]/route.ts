// GET /api/settings/backup/[id] — 下载备份
// DELETE /api/settings/backup/[id] — 删除备份
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, verifyPermission } from '@/lib/auth'
import { existsSync } from 'fs'
import { readFile, rm, readdir } from 'fs/promises'
import { join } from 'path'
import { successResponse, errorResponse } from '@/lib/api-response'

const BACKUP_DIR = '/app/backups'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dir = join(BACKUP_DIR, id)
  if (!existsSync(dir)) return NextResponse.json({ error: '备份不存在' }, { status: 404 })

  // 打包为 tar.gz
  const { execSync } = require('child_process')
  const outPath = `/tmp/${id}.tar.gz`
  execSync(`cd ${BACKUP_DIR} && tar czf ${outPath} ${id}`)

  const buffer = await readFile(outPath)
  // 清理临时文件
  execSync(`rm -f ${outPath}`)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${id}.tar.gz"`,
    },
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value
  if (!token) return errorResponse('未认证', 401)
  const payload = verifyToken(token)
  if (!payload) return errorResponse('登录已过期', 401)
  if (!await verifyPermission(payload.role, 'settings.backup', payload.userId)) {
    return errorResponse('无权限', 403)
  }

  const { id } = await params
  const dir = join(BACKUP_DIR, id)
  if (!existsSync(dir)) return errorResponse('备份不存在', 404)

  try {
    await rm(dir, { recursive: true, force: true })
    return NextResponse.json(successResponse(null))
  } catch (error) {
    console.error('删除备份失败:', error)
    return errorResponse('删除失败', 500)
  }
}
