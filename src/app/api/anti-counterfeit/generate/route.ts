import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { successResponse, errorResponse } from '@/lib/api-response'

/**
 * 生成防伪码
 * POST /api/anti-counterfeit/generate
 * Body: { count: number, productBatchId?: string, productId?: string, prefix?: string }
 */
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'anti-counterfeit.generate', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const body = await req.json()
  const count = Math.min(Math.max(1, body.count || 1), 1000) // 上限1000个
  const prefix = body.prefix || 'AC'
  const productBatchId = body.productBatchId || null
  const productId = body.productId || null
  const ip = extractIp(req)

  // 校验批次是否存在
  if (productBatchId) {
    const batch = await prisma.productBatch.findUnique({ where: { id: productBatchId } })
    if (!batch) return errorResponse('产品批次不存在', 400)
  }

  // 批量生成防伪码
  const codes: string[] = []
  const now = new Date()

  // 使用事务批量插入
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      // 生成唯一防伪码：prefix + 15位随机数字 + 1位校验位
      let code: string
      let exists = true
      let attempts = 0
      do {
        const randomPart = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('')
        const checkDigit = calculateCheckDigit(prefix + randomPart)
        code = prefix + randomPart + checkDigit
        exists = !!(await tx.antiCounterfeitCode.findUnique({ where: { code } }))
        attempts++
        if (attempts > 100) throw new Error('无法生成唯一防伪码，请重试')
      } while (exists)

      await tx.antiCounterfeitCode.create({
        data: {
          code,
          productBatchId,
          productId,
          status: 'ACTIVE',
          createdAt: now,
        },
      })
      codes.push(code)
    }
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'BATCH_GENERATE',
    entity: 'AntiCounterfeitCode',
    detail: { count, prefix, productBatchId, productId },
    ip,
  })

  return NextResponse.json(successResponse({ codes, count: codes.length }), { status: 201 })
}

/**
 * 计算校验位（Luhn算法mod 10）
 */
function calculateCheckDigit(input: string): string {
  const digits = input.replace(/\D/g, '').split('').map(Number)
  let sum = 0
  let alternate = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i]
    if (alternate) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alternate = !alternate
  }
  return ((10 - (sum % 10)) % 10).toString()
}
