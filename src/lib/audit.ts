import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface AuditLogInput {
  userId?: string
  userName?: string
  action: string
  entity: string
  entityId?: string
  detail?: Record<string, unknown>
  ip?: string
}

/**
 * 写入审计日志
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        detail: (input.detail as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ip: input.ip ?? null,
      },
    })
  } catch (error) {
    // 审计日志写入失败不应影响主流程
    console.error('[AuditLog] 写入失败:', error)
  }
}

/**
 * 从请求中提取客户端 IP
 */
export function extractIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}
