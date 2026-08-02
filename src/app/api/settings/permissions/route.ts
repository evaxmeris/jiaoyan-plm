import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// 硬编码的默认权限配置（与 auth.ts 保持一致）
const DEFAULT_OPERATION_ROLES: Record<string, { roles: string[]; description: string }> = {
  // 研发操作
  'formula.view': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '查看配方（核心机密）' },
  'formula.create': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '创建配方' },
  'formula.update': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '编辑配方' },
  'formula.delete': { roles: ['CEO', 'RND_MANAGER'], description: '删除配方' },
  'formula.stabilize': { roles: ['CEO', 'RND_MANAGER'], description: '配方定型' },
  // 原料操作
  'material.view': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION'], description: '查看原料' },
  'material.create': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '创建原料' },
  'material.update': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '编辑原料' },
  'material.delete': { roles: ['CEO', 'RND_MANAGER'], description: '删除原料' },
  // 产品操作
  'product.view': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE'], description: '查看产品' },
  'product.create': { roles: ['CEO', 'RND_MANAGER'], description: '创建产品' },
  'product.update': { roles: ['CEO', 'RND_MANAGER'], description: '编辑产品' },
  'product.delete': { roles: ['CEO'], description: '删除产品' },
  // 合规操作
  'registration.view': { roles: ['CEO', 'COMPLIANCE', 'RND_MANAGER'], description: '查看备案列表' },
  'registration.detail': { roles: ['CEO', 'COMPLIANCE', 'RND_MANAGER'], description: '查看备案详情' },
  'registration.create': { roles: ['CEO', 'COMPLIANCE'], description: '创建备案' },
  'registration.update': { roles: ['CEO', 'COMPLIANCE'], description: '编辑备案' },
  'registration.delete': { roles: ['CEO'], description: '删除备案' },
  'test_entrustment.view': { roles: ['CEO', 'COMPLIANCE', 'RND_MANAGER'], description: '查看检测' },
  'test_entrustment.create': { roles: ['CEO', 'COMPLIANCE', 'RND_MANAGER'], description: '创建检测' },
  'test_entrustment.update': { roles: ['CEO', 'COMPLIANCE', 'RND_MANAGER'], description: '编辑检测' },
  'test_entrustment.delete': { roles: ['CEO'], description: '删除检测' },
  // 采购操作
  'purchase.view': { roles: ['CEO', 'PURCHASER', 'RND_MANAGER', 'FINANCE'], description: '查看采购申请' },
  'purchase.create': { roles: ['CEO', 'PURCHASER'], description: '创建采购申请' },
  'purchase.update': { roles: ['CEO', 'PURCHASER'], description: '编辑采购申请' },
  'purchase.delete': { roles: ['CEO'], description: '删除采购申请' },
  'purchase.approve': { roles: ['CEO', 'RND_MANAGER', 'FINANCE'], description: '审批采购申请' },
  // 库存操作
  'inventory.view': { roles: ['CEO', 'PURCHASER', 'PRODUCTION', 'RND_MANAGER'], description: '查看库存' },
  'inventory.create': { roles: ['CEO', 'PURCHASER', 'PRODUCTION'], description: '创建库存记录' },
  'inventory.update': { roles: ['CEO', 'PURCHASER', 'PRODUCTION'], description: '编辑库存记录' },
  // 资产操作
  'trademark.view': { roles: ['CEO', 'COMPLIANCE'], description: '查看商标' },
  'trademark.create': { roles: ['CEO', 'COMPLIANCE'], description: '创建商标' },
  'trademark.update': { roles: ['CEO', 'COMPLIANCE'], description: '编辑商标' },
  'patent.view': { roles: ['CEO', 'RND_MANAGER', 'COMPLIANCE'], description: '查看专利' },
  'patent.create': { roles: ['CEO', 'RND_MANAGER'], description: '创建专利' },
  'patent.update': { roles: ['CEO', 'RND_MANAGER'], description: '编辑专利' },
  // 供应商操作
  'supplier.view': { roles: ['CEO', 'PURCHASER', 'RND_MANAGER', 'COMPLIANCE'], description: '查看供应商' },
  'supplier.create': { roles: ['CEO', 'PURCHASER'], description: '创建供应商' },
  'supplier.update': { roles: ['CEO', 'PURCHASER'], description: '编辑供应商' },
  'supplier.delete': { roles: ['CEO'], description: '删除供应商' },
  // 技术秘密操作
  'trade_secret.create': { roles: ['CEO'], description: '创建技术秘密' },
  'trade_secret.view': { roles: ['CEO'], description: '查看技术秘密' },
  'trade_secret.update': { roles: ['CEO'], description: '编辑技术秘密' },
  'trade_secret.delete': { roles: ['CEO'], description: '删除技术秘密' },
  // 用户管理
  'user.create': { roles: ['CEO'], description: '创建用户' },
  'user.update': { roles: ['CEO'], description: '编辑用户' },
  // 审计日志
  'audit_log.view': { roles: ['CEO'], description: '查看审计日志' },
  // 服务合同
  'service_contract.view': { roles: ['CEO', 'RND_MANAGER', 'FINANCE'], description: '查看服务合同' },
  'service_contract.create': { roles: ['CEO', 'RND_MANAGER', 'FINANCE'], description: '创建服务合同' },
  'service_contract.update': { roles: ['CEO', 'RND_MANAGER', 'FINANCE'], description: '编辑服务合同' },
  'service_contract.approve': { roles: ['CEO', 'RND_MANAGER', 'FINANCE'], description: '审批服务合同' },
  'service_contract.delete': { roles: ['CEO'], description: '删除服务合同' },
  // 打样管理
  'sample.view': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '查看打样任务' },
  'sample.create': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '创建打样任务' },
  'sample.update': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '编辑打样任务' },
  'sample.delete': { roles: ['CEO', 'RND_MANAGER'], description: '删除打样任务' },
  // 留样管理
  'retained_sample.view': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE'], description: '查看留样记录' },
  'retained_sample.create': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '创建留样记录' },
  'retained_sample.update': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '编辑留样记录' },
  'retained_sample.delete': { roles: ['CEO', 'RND_MANAGER'], description: '删除留样记录' },
  // 稳定性跟踪
  'stability.view': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '查看稳定性测试' },
  'stability.create': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '创建稳定性测试' },
  'stability.update': { roles: ['CEO', 'RND_MANAGER', 'DEVELOPER'], description: '编辑稳定性测试' },
  'stability.delete': { roles: ['CEO', 'RND_MANAGER'], description: '删除稳定性测试' },
  // 预算管理
  'budget.view': { roles: ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'], description: '查看预算' },
  'budget.create': { roles: ['CEO', 'FINANCE'], description: '创建预算' },
  'budget.update': { roles: ['CEO', 'FINANCE'], description: '编辑预算' },
  'budget.delete': { roles: ['CEO'], description: '删除预算' },
  // 物资管理
  'supply.view': { roles: ['CEO', 'PURCHASER', 'PRODUCTION', 'RND_MANAGER'], description: '查看物资' },
  'supply.create': { roles: ['CEO', 'PURCHASER', 'PRODUCTION'], description: '创建物资' },
  'supply.update': { roles: ['CEO', 'PURCHASER', 'PRODUCTION'], description: '编辑物资' },
  'supply.delete': { roles: ['CEO'], description: '删除物资' },
  'supply.stock_in': { roles: ['CEO', 'PURCHASER', 'PRODUCTION'], description: '物资入库' },
  // 物流发运
  'shipping.view': { roles: ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION'], description: '查看发货单' },
  'shipping.create': { roles: ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'], description: '创建发货单' },
  'shipping.update': { roles: ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'], description: '编辑发货单' },
  'shipping.delete': { roles: ['CEO'], description: '删除发货单' },
  'shipping.status': { roles: ['CEO', 'FINANCE', 'PURCHASER', 'PRODUCTION'], description: '状态流转（拣货/打包/发货/签收）' },
  'logistics_provider.view': { roles: ['CEO', 'FINANCE', 'PURCHASER', 'RND_MANAGER', 'PRODUCTION'], description: '查看物流商' },
  'logistics_provider.create': { roles: ['CEO', 'FINANCE', 'PURCHASER'], description: '创建物流商' },
  'logistics_provider.update': { roles: ['CEO', 'FINANCE', 'PURCHASER'], description: '编辑物流商' },
  'logistics_provider.delete': { roles: ['CEO'], description: '删除物流商' },
}

const ALL_ROLES = ['CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE', 'PURCHASER', 'FINANCE', 'PRODUCTION', 'OBSERVER']

// GET /api/settings/permissions — 返回合并后的权限配置
export async function GET() {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'audit_log.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  // 从数据库读取覆盖配置
  const dbConfigs: { operation: string; allowedRoles: string[] }[] = await prisma.permissionConfig.findMany()
  const overrides = new Map<string, string[]>(dbConfigs.map(c => [c.operation, c.allowedRoles]))

  // 合并：数据库覆盖优先
  const merged: Record<string, { allowedRoles: string[]; description: string }> = {}
  for (const [op, config] of Object.entries(DEFAULT_OPERATION_ROLES)) {
    merged[op] = {
      allowedRoles: overrides.get(op) ?? config.roles,
      description: config.description,
    }
  }

  // 获取所有用户及其权限覆盖
  const userPermissions = await prisma.userPermission.findMany({
    select: {
      userId: true,
      operation: true,
      granted: true,
      user: { select: { name: true, email: true, role: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // 按用户分组
  const userOverridesMap = new Map<string, { name: string; email: string; role: string; overrides: { operation: string; granted: boolean }[] }>()
  for (const up of userPermissions) {
    if (!userOverridesMap.has(up.userId)) {
      userOverridesMap.set(up.userId, {
        name: up.user.name,
        email: up.user.email,
        role: up.user.role,
        overrides: [],
      })
    }
    userOverridesMap.get(up.userId)!.overrides.push({
      operation: up.operation,
      granted: up.granted,
    })
  }
  const userOverrides = Object.fromEntries(userOverridesMap)

  return NextResponse.json(successResponse({
    permissions: merged,
    allRoles: ALL_ROLES,
    defaultPermissions: Object.fromEntries(
      Object.entries(DEFAULT_OPERATION_ROLES).map(([op, config]) => [op, config.roles])
    ),
    userOverrides,
  }))
}

// PUT /api/settings/permissions — 更新指定操作的权限
export async function PUT(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  // 仅 CEO 可修改权限
  if (user.role !== 'CEO') {
    return errorResponse('仅 CEO 可修改权限配置', 403)
  }

  const body = await req.json()
  const { operation, allowedRoles } = body

  if (!operation || !Array.isArray(allowedRoles)) {
    return errorResponse('缺少 operation 或 allowedRoles', 400)
  }

  // 验证操作名是否存在
  if (!(operation in DEFAULT_OPERATION_ROLES)) {
    return errorResponse(`未知操作: ${operation}`, 400)
  }

  // 验证角色名合法性
  const invalidRoles = allowedRoles.filter(r => !ALL_ROLES.includes(r))
  if (invalidRoles.length > 0) {
    return errorResponse(`无效角色: ${invalidRoles.join(', ')}`, 400)
  }

  // CEO 必须始终拥有权限
  if (!allowedRoles.includes('CEO')) {
    allowedRoles.push('CEO')
  }

  const config = DEFAULT_OPERATION_ROLES[operation]

  // 写入/更新数据库
  await prisma.permissionConfig.upsert({
    where: { operation },
    create: {
      operation,
      allowedRoles,
      description: config.description,
    },
    update: {
      allowedRoles,
    },
  })

  return NextResponse.json(successResponse({ operation, allowedRoles }))
}
