import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { writeAuditLog, extractIp } from '@/lib/audit'
import { autoCalculateCosting } from '@/app/api/rnd/costing/auto-costing'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/rnd/formulas/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!await verifyPermission(user.role, 'formula.view', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const formula = await prisma.formula.findFirst({
    where: { id, isDeleted: false },
    include: {
      items: { include: { rawMaterial: true } },
      products: { select: { id: true, name: true, status: true } },
      _count: { select: { versions: true } },
    },
  })
  if (!formula) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  // 核心配方 RBAC：非 CEO 用户访问 isCore 配方时返回 403
  if (formula.isCore && user.role !== 'CEO') {
    return NextResponse.json({ error: '无权访问核心保密配方' }, { status: 403 })
  }

  return NextResponse.json(successResponse(formula))
}

// PUT /api/rnd/formulas/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  // 权限校验：修改配方需要 formula.update 权限
  if (!await verifyPermission(user.role, 'formula.update', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const ip = extractIp(req)

  // 获取旧状态（含 items，用于审计 + 版本快照）
  const oldFormula = await prisma.formula.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!oldFormula) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  // 如果要将状态变更为 STABILIZED，需要更高权限
  if (body.status === 'STABILIZED' && oldFormula.status !== 'STABILIZED') {
    if (!await verifyPermission(user.role, 'formula.stabilize', user.id)) {
      return NextResponse.json({ error: '配方定型需要主管权限' }, { status: 403 })
    }
  }

  // 构建变更详情
  const changes: Record<string, { old: unknown; new: unknown }> = {}
  const fields = ['name', 'status', 'batchSize', 'isCore', 'processParams', 'remark']
  for (const f of fields) {
    if (body[f] !== undefined && body[f] !== (oldFormula as any)[f]) {
      changes[f] = { old: (oldFormula as any)[f], new: body[f] }
    }
  }

  // ── 成分编辑校验 ──────────────────────────────────────────
  let hasItemsChange = false
  if (body.items !== undefined) {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: '配方成分不能为空' }, { status: 400 })
    }

    // 后端校验百分比总和 = 100%（容差 0.5%）
    const totalPercentage = body.items.reduce(
      (sum: number, item: { percentage: number }) => sum + item.percentage,
      0,
    )
    if (Math.abs(totalPercentage - 100) > 0.5) {
      return NextResponse.json(
        {
          error: `成分百分比总和必须为 100%，当前为 ${totalPercentage.toFixed(2)}%`,
        },
        { status: 400 },
      )
    }

    hasItemsChange = true
    changes['items'] = {
      old: `${oldFormula.items.length} items`,
      new: `${body.items.length} items`,
    }
  }

  // ── 版本自动递增 ──────────────────────────────────────────
  // 格式 V{d}.{d} → 递增 minor
  const nextVersion = (() => {
    const match = oldFormula.version.match(/^V(\d+)\.(\d+)$/)
    if (!match) return 'V1.0'
    const major = parseInt(match[1])
    const minor = parseInt(match[2])
    return `V${major}.${minor + 1}`
  })()

  // ── 原子事务：删除旧成分 + 创建新成分 + 更新 formula + 创建版本快照 ──
  const formula = await prisma.$transaction(async (tx) => {
    // 替换成分
    if (body.items !== undefined) {
      await tx.formulaItem.deleteMany({ where: { formulaId: id } })
      await tx.formulaItem.createMany({
        data: body.items.map(
          (item: {
            rawMaterialId: string
            percentage: number
            weight?: number | null
            cost?: number | null
            orderIndex?: number
            remark?: string | null
          }, idx: number) => ({
            formulaId: id,
            rawMaterialId: item.rawMaterialId,
            percentage: item.percentage,
            weight: item.weight ?? null,
            cost: item.cost ?? null,
            orderIndex: item.orderIndex ?? idx,
            remark: item.remark ?? null,
          }),
        ),
      })
    }

    // 重新计算 totalCost（用最新成分的 cost 汇总）
    const costItems = body.items !== undefined ? body.items : oldFormula.items
    const totalCost = costItems.reduce(
      (sum: number, item: { cost?: number | null }) => sum + (item.cost ?? 0),
      0,
    )

    // 更新 formula 元数据 + totalCost + 版本号
    const updated = await tx.formula.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        batchSize: body.batchSize ?? undefined,
        status: body.status ?? undefined,
        isCore: body.isCore ?? undefined,
        processParams: body.processParams ?? undefined,
        remark: body.remark ?? undefined,
        totalCost,
        version: hasItemsChange ? nextVersion : undefined,
      },
      include: { items: { include: { rawMaterial: true } } },
    })

    // 成分变更时创建版本快照
    if (hasItemsChange) {
      await tx.formulaVersion.create({
        data: {
          formulaId: id,
          version: nextVersion,
          snapshot: JSON.parse(JSON.stringify(updated.items)),
          changedBy: user.name,
          changeLog: `成分已更新（${oldFormula.items.length} → ${body.items.length} 项）`,
        },
      })
    }

    return updated
  })

  // C1: 研发→合规自动衔接 — 配方定型时自动创建/更新备案草稿
  if (body.status === 'STABILIZED' && oldFormula.status !== 'STABILIZED') {
    const products = await prisma.productDesign.findMany({ where: { formulaId: id, isDeleted: false } })

    for (const product of products) {
      // 查找是否已有备案草稿
      const existingReg = await prisma.registration.findFirst({
        where: { productId: product.id, status: 'APPLYING' },
      })

      if (existingReg) {
        // 更新现有备案的备注标记需要重新提交
        await prisma.registration.update({
          where: { id: existingReg.id },
          data: { remark: `配方已定型(${new Date().toLocaleDateString('zh-CN')})，请提交备案材料` },
        })
      } else {
        // 创建新的备案草稿
        await prisma.registration.create({
          data: {
            productId: product.id,
            registerType: '国产普通',
            status: 'APPLYING',
            remark: `配方定型自动创建备案草稿 — ${new Date().toLocaleDateString('zh-CN')}`,
          },
        })
      }
    }
  }

  // 写入审计日志
  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: body.status !== oldFormula.status ? 'STATUS_CHANGE' : 'UPDATE',
    entity: 'Formula',
    entityId: id,
    detail: {
      changes,
      newStatus: formula.status,
      oldStatus: oldFormula.status,
      autoCreatedRegistrations: body.status === 'STABILIZED',
      newVersion: hasItemsChange ? nextVersion : undefined,
    },
    ip,
  })

  // ── 配方保存 → 成本自动计算 ──────────────────────────────────
  // 不阻塞前端，try/catch 包裹，不影响主流程
  if (hasItemsChange) {
    await autoCalculateCosting(id, user).catch((err) =>
      console.error('[AutoCosting] 自动核算异常:', err),
    )
  }

  // ── 配方保存 → 合规自动扫描（阻止禁用成分保存） ──────────────────
  // 如果发现禁用成分，返回 400；限用成分不阻断，仅警告
  // try/catch 包裹，扫描异常不影响正常保存
  try {
    const scanRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/compliance/scan-formula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formulaId: id }),
    })
    if (scanRes.ok) {
      const scanData = await scanRes.json()
      // 检查禁用成分（PROHIBITED 类型）
      const prohibitedItems = (scanData.results || []).filter(
        (r: any) => r.type === 'PROHIBITED',
      )
      if (prohibitedItems.length > 0) {
        const names = prohibitedItems
          .map((r: any) => r.rawMaterial?.nameCn || '未知成分')
          .join('、')
        return NextResponse.json(
          { error: `配方含禁用成分：${names}` },
          { status: 400 },
        )
      }
      // 无禁用成分时写入审计日志
      await writeAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'COMPLIANCE_SCAN',
        entity: 'Formula',
        entityId: id,
        detail: {
          overall: scanData.overall,
          summary: scanData.summary,
          hasProhibited: false,
        },
      })
    }
  } catch (err) {
    console.error('[ComplianceScan] 合规扫描异常（不影响保存）:', err)
  }

  return NextResponse.json(successResponse(formula))
}

// DELETE /api/rnd/formulas/[id] — 软删除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  if (!await verifyPermission(user.role, 'formula.delete', user.id)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const { id } = await params
  const ip = extractIp(req)

  await prisma.formula.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  await writeAuditLog({
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'Formula',
    entityId: id,
    ip,
  })

  return NextResponse.json(successResponse({ ok: true }))
}
