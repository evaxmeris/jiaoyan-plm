// GET /api/settings/backup — 列出备份
// POST /api/settings/backup — 创建备份
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, verifyPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createBackup, listBackups } from '@/lib/backup'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) return errorResponse('未认证', 401)
  const payload = verifyToken(token)
  if (!payload) return errorResponse('登录已过期', 401)
  if (!await verifyPermission(payload.role, 'settings.backup', payload.userId)) {
    return errorResponse('无权限', 403)
  }

  try {
    const backups = await listBackups()
    return NextResponse.json(successResponse({ backups }))
  } catch (error) {
    console.error('获取备份列表失败:', error)
    return errorResponse('获取失败', 500)
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) return errorResponse('未认证', 401)
  const payload = verifyToken(token)
  if (!payload) return errorResponse('登录已过期', 401)
  if (!await verifyPermission(payload.role, 'settings.backup', payload.userId)) {
    return errorResponse('无权限', 403)
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
    const manifest = await createBackup(user?.name || '未知用户')
    return NextResponse.json(successResponse({ backup: manifest }), { status: 201 })
  } catch (error) {
    console.error('创建备份失败:', error)
    return errorResponse('备份失败', 500)
  }
}
