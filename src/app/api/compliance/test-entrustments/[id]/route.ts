import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { TestEntrustmentSchema, validateBody } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET — 详情（复用通用处理）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'test_entrustment.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const record = await prisma.testEntrustment.findUnique({ where: { id } })
  if (!record) return errorResponse('委托检测记录不存在', 404)
  return NextResponse.json({ success: true, data: record, testEntrustment: record })
}

// PUT — 更新委托检测（含自动复检 + 产品状态联动）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'test_entrustment.update', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const validated = await validateBody(req, TestEntrustmentSchema.partial().passthrough())
  if (!validated.success) return validated.response
  const body = validated.data as any
  const ip = extractIp(req)

  // 获取旧状态
  const oldRecord = await prisma.testEntrustment.findUnique({ where: { id } })
  if (!oldRecord) return errorResponse('委托检测记录不存在', 404)

  const updated = await prisma.testEntrustment.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      result: body.result ?? undefined,
      reportNo: body.reportNo ?? undefined,
      reportUrl: body.reportUrl ?? undefined,
      completeDate: body.completeDate ? new Date(body.completeDate) : undefined,
      reportDate: body.reportDate ? new Date(body.reportDate) : undefined,
      sendDate: body.sendDate ? new Date(body.sendDate) : undefined,
      cost: body.cost !== undefined ? parseFloat(body.cost) : undefined,
      remark: body.remark ?? undefined,
    },
  })

  // C3: 检测 FAIL → 自动创建复检
  if (body.status === 'COMPLETED' && body.result === 'FAIL' && oldRecord.status !== 'COMPLETED') {
    // 计算复检序号：查找已有复检数量
    const recheckCount = await prisma.testEntrustment.count({
      where: {
        registrationId: oldRecord.registrationId,
        remark: { startsWith: '复检-' },
      },
    })

    await prisma.testEntrustment.create({
      data: {
        registrationId: oldRecord.registrationId,
        productDesignId: oldRecord.productDesignId,
        productName: oldRecord.productName,
        type: oldRecord.type,
        institution: oldRecord.institution,
        testItems: oldRecord.testItems as any,
        sampleBatch: oldRecord.sampleBatch,
        status: 'PENDING',
        result: 'PENDING',
        remark: `复检-${recheckCount + 1}`,
      },
    })
  }

  // C2: 检测完成→产品状态联动
  if (body.status === 'COMPLETED' && oldRecord.status !== 'COMPLETED') {
    const productDesignId = updated.productDesignId
    if (productDesignId) {
      // 获取该产品的所有委托检测
      const allRecords = await prisma.testEntrustment.findMany({
        where: { productDesignId, isDeleted: false },
      })

      if (allRecords.length > 0) {
        const allCompleted = allRecords.every(r => r.status === 'COMPLETED')
        const allPassed = allRecords.every(r => r.result === 'PASS')

        if (allCompleted && allPassed) {
          // 全部通过 → 推进到备案中
          await prisma.productDesign.update({
            where: { id: productDesignId },
            data: { status: 'REGISTERING' },
          })
        } else if (allCompleted) {
          // 有任一 FAIL → 标记为测试中（需复检）
          const hasFail = allRecords.some(r => r.result === 'FAIL')
          if (hasFail) {
            await prisma.productDesign.update({
              where: { id: productDesignId },
              data: { status: 'TESTING' },
            })
          }
        }
      }
    }
  }

  // 写入审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status !== oldRecord.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'TestEntrustment',
    entityId: id,
    detail: {
      oldStatus: oldRecord.status,
      newStatus: updated.status,
      result: updated.result,
      productDesignId: updated.productDesignId,
      autoUpdatedProduct: oldRecord.status !== 'COMPLETED' && body.status === 'COMPLETED',
    },
    ip,
  })

  return NextResponse.json(successResponse({ testEntrustment: updated }))
}

// DELETE — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)

  if (!await verifyPermission(user.role, 'test_entrustment.delete', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { id } = await params
  const ip = extractIp(req)

  const existing = await prisma.testEntrustment.findUnique({ where: { id } })
  if (!existing || existing.isDeleted) {
    return errorResponse('委托检测记录不存在', 404)
  }

  await prisma.testEntrustment.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'TestEntrustment',
    entityId: id,
    detail: { productName: existing.productName, institution: existing.institution },
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
