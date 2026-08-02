import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

/**
 * 健康检查端点 — 用于 Docker 健康检查、负载均衡、监控系统
 * GET /api/health
 *
 * 返回：
 *   200 { status: 'ok', db: 'ok', uptime, timestamp } — 服务正常
 *   503 { status: 'error', db: 'error', ... }         — 服务异常
 */
export async function GET() {
  const start = Date.now()
  const health = {
    status: 'ok',
    db: 'unknown',
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }

  try {
    // 数据库连通性检查
    await prisma.$queryRaw`SELECT 1`
    health.db = 'ok'
  } catch (err) {
    health.status = 'error'
    health.db = 'error'
    return NextResponse.json({ ...health, success: false }, { status: 503 })
  }

  const responseTime = Date.now() - start
  return NextResponse.json(successResponse({
    ...health,
    responseTime: `${responseTime}ms`,
  }))
}
