import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// 所有可用的操作列表（与 DEFAULT_OPERATION_ROLES 保持一致）
const ALL_OPERATIONS = [
  'formula.view', 'formula.create', 'formula.update', 'formula.delete', 'formula.stabilize',
  'material.view', 'material.create', 'material.update', 'material.delete',
  'product.view', 'product.create', 'product.update', 'product.delete',
  'registration.view', 'registration.create', 'registration.update', 'registration.delete',
  'test_entrustment.view', 'test_entrustment.create', 'test_entrustment.update', 'test_entrustment.delete',
  'supplier.view', 'supplier.create', 'supplier.update', 'supplier.delete',
  'trademark.view', 'trademark.create', 'trademark.update',
  'patent.view', 'patent.create', 'patent.update',
  'purchase.view', 'purchase.create', 'purchase.update', 'purchase.delete', 'purchase.approve',
  'inventory.view', 'inventory.create', 'inventory.update',
  'budget.view', 'service_contract.view', 'service_contract.create', 'service_contract.update', 'service_contract.approve', 'service_contract.delete',
  'sample.view', 'pilot_run.view', 'distribution.view', 'sales_order.view',
  'trade_secret.create', 'trade_secret.view', 'trade_secret.update', 'trade_secret.delete',
  'user.view', 'user.create', 'user.update',
  'anti_counterfeit.view', 'approval_flow.view', 'audit_log.view',
]

const OPERATION_DESCRIPTIONS: Record<string, string> = {
  'formula.view': '查看配方（核心机密）',
  'formula.create': '创建配方',
  'formula.update': '编辑配方',
  'formula.delete': '删除配方',
  'formula.stabilize': '配方定型',
  'material.view': '查看原料',
  'material.create': '创建原料',
  'material.update': '编辑原料',
  'material.delete': '删除原料',
  'product.view': '查看产品',
  'product.create': '创建产品',
  'product.update': '编辑产品',
  'product.delete': '删除产品',
  'registration.view': '查看备案',
  'registration.create': '创建备案',
  'registration.update': '编辑备案',
  'registration.delete': '删除备案',
  'test_entrustment.view': '查看检测',
  'test_entrustment.create': '创建检测',
  'test_entrustment.update': '编辑检测',
  'test_entrustment.delete': '删除检测',
  'supplier.view': '查看供应商',
  'supplier.create': '创建供应商',
  'supplier.update': '编辑供应商',
  'supplier.delete': '删除供应商',
  'trademark.view': '查看商标',
  'trademark.create': '创建商标',
  'trademark.update': '编辑商标',
  'patent.view': '查看专利',
  'patent.create': '创建专利',
  'patent.update': '编辑专利',
  'purchase.view': '查看采购申请',
  'purchase.create': '创建采购申请',
  'purchase.update': '编辑采购申请',
  'purchase.delete': '删除采购申请',
  'purchase.approve': '审批采购申请',
  'inventory.view': '查看库存',
  'inventory.create': '创建库存记录',
  'inventory.update': '编辑库存记录',
  'budget.view': '查看预算',
  'service_contract.view': '查看服务合同',
  'service_contract.create': '创建服务合同',
  'service_contract.update': '编辑服务合同',
  'service_contract.approve': '审批服务合同',
  'service_contract.delete': '删除服务合同',
  'sample.view': '查看打样',
  'pilot_run.view': '查看试产',
  'distribution.view': '查看分销',
  'sales_order.view': '查看销售订单',
  'trade_secret.create': '创建技术秘密',
  'trade_secret.view': '查看技术秘密',
  'trade_secret.update': '编辑技术秘密',
  'trade_secret.delete': '删除技术秘密',
  'user.view': '查看用户管理',
  'user.create': '创建用户',
  'user.update': '编辑用户',
  'anti_counterfeit.view': '查看防伪管理',
  'approval_flow.view': '查看审批流程设置',
  'audit_log.view': '查看审计日志',
}

// GET /api/users/[id]/permissions — 获取指定用户的权限覆盖列表
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.permission', user.id)) {
    return errorResponse('权限不足', 403)
  }
  if (user.role !== 'CEO') {
    return errorResponse('仅 CEO 可管理权限覆盖', 403)
  }

  const { id } = await params

  // 验证目标用户存在
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, deletedAt: true },
  })
  if (!targetUser || targetUser.deletedAt) {
    return errorResponse('用户不存在', 404)
  }

  // 获取该用户的所有权限覆盖
  const overrides = await prisma.userPermission.findMany({
    where: { userId: id },
    select: { id: true, operation: true, granted: true, createdAt: true },
  })

  const overrideMap = new Map(overrides.map(o => [o.operation, o]))

  // 构建完整操作列表（含覆盖状态）
  const allPermissions = ALL_OPERATIONS.map(op => {
    const existing = overrideMap.get(op)
    return {
      operation: op,
      description: OPERATION_DESCRIPTIONS[op] || op,
      override: existing ? { id: existing.id, granted: existing.granted } : null,
    }
  })

  return NextResponse.json(successResponse({
    user: targetUser,
    permissions: allPermissions,
  }))
}

// PUT /api/users/[id]/permissions — 设置或取消用户的某项权限覆盖
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.permission', user.id)) {
    return errorResponse('权限不足', 403)
  }
  if (user.role !== 'CEO') {
    return errorResponse('仅 CEO 可修改权限覆盖', 403)
  }

  const { id } = await params
  const body = await req.json()
  const { operation, granted } = body

  if (!operation) {
    return errorResponse('缺少 operation', 400)
  }

  if (!ALL_OPERATIONS.includes(operation)) {
    return errorResponse(`未知操作: ${operation}`, 400)
  }

  // 验证目标用户存在
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!targetUser) {
    return errorResponse('用户不存在', 404)
  }

  // 不允许修改自己的覆盖（避免锁定自己）
  if (id === user.id) {
    return errorResponse('不能修改自己的权限覆盖', 400)
  }

  if (granted === true || granted === false) {
    // UPSERT: 设置覆盖（允许/拒绝）
    const perm = await prisma.userPermission.upsert({
      where: { userId_operation: { userId: id, operation } },
      create: { userId: id, operation, granted },
      update: { granted },
    })
    return NextResponse.json(successResponse({ permission: perm }))
  } else if (granted === null) {
    // DELETE: 移除覆盖，恢复角色判断
    await prisma.userPermission.deleteMany({
      where: { userId: id, operation },
    })
    return NextResponse.json(successResponse({ removed: true }))
  }

  return errorResponse('granted 必须是 true/false 或 null', 400)
}

// DELETE /api/users/[id]/permissions — 移除所有权限覆盖（重置）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'user.permission', user.id)) {
    return errorResponse('权限不足', 403)
  }
  if (user.role !== 'CEO') {
    return errorResponse('仅 CEO 可修改权限覆盖', 403)
  }

  const { id } = await params

  if (id === user.id) {
    return errorResponse('不能修改自己的权限覆盖', 400)
  }

  await prisma.userPermission.deleteMany({
    where: { userId: id },
  })

  return NextResponse.json(successResponse({ message: '权限覆盖已全部清除' }))
}
