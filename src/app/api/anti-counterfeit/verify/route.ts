import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

/**
 * 验证防伪码（消费者接口，无需登录）
 * POST /api/anti-counterfeit/verify
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { code } = body

  if (!code || typeof code !== 'string') {
    return errorResponse('请输入防伪码', 400)
  }

  const trimmedCode = code.trim().toUpperCase()

  // 查找防伪码
  const record = await prisma.antiCounterfeitCode.findUnique({
    where: { code: trimmedCode },
    include: {
      batch: {
        include: {
          traceItems: { take: 1 }, // 仅用于确认批次存在
        },
      },
    },
  })

  if (!record) {
    return NextResponse.json(successResponse({
      authentic: false,
      message: '未找到该防伪码，请注意假冒产品',
      code: trimmedCode,
    }))
  }

  // 检查有效期
  if (record.expiredAt && record.expiredAt < new Date()) {
    return NextResponse.json(successResponse({
      authentic: false,
      message: '该防伪码已过期',
      code: trimmedCode,
    }))
  }

  // 检查是否已作废
  if (record.status === 'REVOKED') {
    return NextResponse.json(successResponse({
      authentic: false,
      message: '该防伪码已被作废，请注意假冒产品',
      code: trimmedCode,
    }))
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'

  // 首次验证
  if (record.status === 'ACTIVE' && record.verifyCount === 0) {
    await prisma.antiCounterfeitCode.update({
      where: { id: record.id },
      data: {
        status: 'VERIFIED',
        firstVerifiedAt: new Date(),
        firstVerifiedIp: ip,
        verifyCount: 1,
      },
    })

    return NextResponse.json(successResponse({
      authentic: true,
      firstVerified: true,
      firstVerifiedAt: new Date().toISOString(),
      verifyCount: 1,
      productName: record.productId || null,
      message: '✅ 正品验证通过！该防伪码为首次查询。',
    }))
  }

  // 重复验证
  const newCount = record.verifyCount + 1
  await prisma.antiCounterfeitCode.update({
    where: { id: record.id },
    data: { verifyCount: newCount },
  })

  return NextResponse.json(successResponse({
    authentic: true,
    firstVerified: false,
    firstVerifiedAt: record.firstVerifiedAt?.toISOString() || null,
    verifyCount: newCount,
    productName: record.productId || null,
    message: `⚠️ 该防伪码已被验证过 ${newCount} 次，首次验证时间：${record.firstVerifiedAt?.toLocaleString('zh-CN') || '未知'}`,
  }))
}
