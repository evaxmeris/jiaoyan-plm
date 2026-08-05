import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET

export interface JWTPayload {
  userId: string
  email: string
  role: string
  name: string
}

export function signToken(payload: JWTPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET 环境变量未设置')
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    if (!JWT_SECRET) throw new Error('JWT_SECRET 环境变量未设置')
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

// 从 cookies 验证身份，返回 user 或 null
export async function verifyAuth(): Promise<{
  id: string; name: string; email: string; role: string; department: string | null; status?: string
} | null> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return null

    const payload = verifyToken(token)
    if (!payload) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, department: true },
    })
    return user
  } catch {
    return null
  }
}

// 角色层级定义（数值越大权限越高）
const ROLE_HIERARCHY: Record<string, number> = {
  OBSERVER: 0,
  DEVELOPER: 10,
  PURCHASER: 10,
  PRODUCTION: 10,
  FINANCE: 20,
  COMPLIANCE: 20,
  RND_MANAGER: 30,
  CEO: 99,
}

// 各操作允许的角色白名单
const OPERATION_ROLES: Record<string, string[]> = {
  // 研发操作
  'formula.view': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'formula.create': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'formula.update': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'formula.delete': ['CEO', 'RND_MANAGER'],
  'formula.stabilize': ['CEO', 'RND_MANAGER'], // 定型需要主管权限
  // 原料操作
  'material.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION'],
  'material.create': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'material.update': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'material.delete': ['CEO', 'RND_MANAGER'],
  // 产品操作
  'product.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE'],
  'product.create': ['CEO', 'RND_MANAGER'],
  'product.update': ['CEO', 'RND_MANAGER'],
  'product.delete': ['CEO'],
  // 合规操作
  'registration.view': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'registration.detail': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'registration.create': ['CEO', 'COMPLIANCE'],
  'registration.update': ['CEO', 'COMPLIANCE'],
  'registration.delete': ['CEO'],
  // 备案材料清单
  'registration_document.create': ['CEO', 'COMPLIANCE'],
  'registration_document.update': ['CEO', 'COMPLIANCE'],
  'registration_document.delete': ['CEO', 'COMPLIANCE'],
  'assessment.view': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'assessment.create': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'assessment.update': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'assessment.delete': ['CEO'],
  'test_entrustment.view': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'test_entrustment.create': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'test_entrustment.update': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'test_entrustment.delete': ['CEO'],
  // 功效宣称
  'efficacy_claim.view': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'efficacy_claim.create': ['CEO', 'COMPLIANCE'],
  'efficacy_claim.update': ['CEO', 'COMPLIANCE', 'RND_MANAGER'],
  'efficacy_claim.delete': ['CEO'],
  // 采购操作
  'purchase.view': ['CEO', 'PURCHASER', 'RND_MANAGER', 'FINANCE'],
  'purchase.create': ['CEO', 'PURCHASER'],
  'purchase.update': ['CEO', 'PURCHASER'],
  'purchase.delete': ['CEO'],
  'purchase.approve': ['CEO', 'RND_MANAGER', 'FINANCE'],
  // 库存操作
  'inventory.view': ['CEO', 'PURCHASER', 'PRODUCTION', 'RND_MANAGER'],
  'inventory.create': ['CEO', 'PURCHASER', 'PRODUCTION'],
  'inventory.update': ['CEO', 'PURCHASER', 'PRODUCTION'],
  'inventory.delete': ['CEO'],
  'inventory.stock_out': ['CEO', 'PURCHASER', 'PRODUCTION'],
  'inventory.status': ['CEO', 'PURCHASER', 'PRODUCTION'],
  // 资产操作
  'trademark.view': ['CEO', 'COMPLIANCE'],
  'trademark.create': ['CEO', 'COMPLIANCE'],
  'trademark.update': ['CEO', 'COMPLIANCE'],
  'patent.view': ['CEO', 'RND_MANAGER', 'COMPLIANCE'],
  'patent.create': ['CEO', 'RND_MANAGER'],
  'patent.update': ['CEO', 'RND_MANAGER'],
  // 供应商操作
  'supplier.view': ['CEO', 'PURCHASER', 'RND_MANAGER', 'COMPLIANCE'],
  'supplier.create': ['CEO', 'PURCHASER'],
  'supplier.update': ['CEO', 'PURCHASER'],
  'supplier.delete': ['CEO'],
  // 系统设置
  'settings.backup': ['CEO'],
  // 技术秘密操作（仅CEO可读写）
  'trade_secret.create': ['CEO'],
  'trade_secret.view': ['CEO'],
  'trade_secret.update': ['CEO'],
  'trade_secret.delete': ['CEO'],
  // 用户管理
  'user.create': ['CEO'],
  'user.update': ['CEO'],
  'user.view': ['CEO'],
  // 审计日志
  'audit_log.view': ['CEO'],
  // 服务合同
  'service_contract.view': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'service_contract.create': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'service_contract.update': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'service_contract.approve': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'service_contract.delete': ['CEO'],
  // 预算管理
  'budget.view': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'budget.create': ['CEO', 'FINANCE'],
  'budget.update': ['CEO', 'FINANCE'],
  'budget.delete': ['CEO'],
  // 报销管理
  'reimbursement.view': ['CEO', 'FINANCE'],
  'reimbursement.create': ['CEO', 'FINANCE'],
  'reimbursement.update': ['CEO', 'FINANCE'],
  'reimbursement.delete': ['CEO'],
  // 打样管理
  'sample.view': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'sample.create': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'sample.update': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'sample.delete': ['CEO', 'RND_MANAGER'],
  // 留样管理
  'retained_sample.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE'],
  'retained_sample.create': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'retained_sample.update': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'retained_sample.delete': ['CEO', 'RND_MANAGER'],
  // 试产管理
  'pilot_run.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PRODUCTION'],
  'pilot_run.create': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'pilot_run.update': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'pilot_run.delete': ['CEO', 'RND_MANAGER'],
  // 稳定性跟踪
  'stability.view': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'stability.create': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'stability.update': ['CEO', 'RND_MANAGER', 'DEVELOPER'],
  'stability.delete': ['CEO', 'RND_MANAGER'],
  // 制程检验 IPQC
  'ipqc.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PRODUCTION'],
  'ipqc.create': ['CEO', 'RND_MANAGER', 'PRODUCTION'],
  'ipqc.update': ['CEO', 'RND_MANAGER', 'PRODUCTION'],
  'ipqc.delete': ['CEO', 'RND_MANAGER'],
  // 出厂检验 OQC
  'oqc.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE'],
  'oqc.create': ['CEO', 'RND_MANAGER', 'COMPLIANCE'],
  'oqc.update': ['CEO', 'RND_MANAGER', 'COMPLIANCE'],
  'oqc.delete': ['CEO', 'RND_MANAGER'],
  // 物资管理
  'supply.view': ['CEO', 'PURCHASER', 'PRODUCTION', 'RND_MANAGER'],
  'supply.create': ['CEO', 'PURCHASER', 'PRODUCTION'],
  'supply.update': ['CEO', 'PURCHASER', 'PRODUCTION'],
  'supply.delete': ['CEO'],
  'supply.stock_in': ['CEO', 'PURCHASER', 'PRODUCTION'],
  // 溯源系统
  'traceability.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PRODUCTION', 'COMPLIANCE', 'PURCHASER'],
  'traceability.search': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PRODUCTION', 'COMPLIANCE', 'PURCHASER'],
  // 物流发运
  'shipping.view': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION'],
  'shipping.create': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'shipping.update': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'shipping.delete': ['CEO'],
  'shipping.status': ['CEO', 'FINANCE', 'PURCHASER', 'PRODUCTION'],
  'logistics_provider.view': ['CEO', 'FINANCE', 'PURCHASER', 'RND_MANAGER', 'PRODUCTION'],
  'logistics_provider.create': ['CEO', 'FINANCE', 'PURCHASER'],
  'logistics_provider.update': ['CEO', 'FINANCE', 'PURCHASER'],
  'logistics_provider.delete': ['CEO'],
  // 分销渠道
  'distribution_channel.view': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION', 'COMPLIANCE', 'DEVELOPER'],
  'distribution_channel.create': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'distribution_channel.update': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'distribution_channel.delete': ['CEO'],
  // 成本核算
  'costing.view': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'costing.create': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'costing.update': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'costing.delete': ['CEO'],
  // 价格历史
  'price_history.view': ['CEO', 'RND_MANAGER', 'FINANCE'],
  'price_history.create': ['CEO', 'RND_MANAGER', 'FINANCE'],
  // 审批管理
  'approval.view': ['CEO', 'RND_MANAGER', 'FINANCE', 'PURCHASER', 'COMPLIANCE'],
  'approval.approve': ['CEO', 'RND_MANAGER', 'FINANCE', 'PURCHASER', 'COMPLIANCE'],
  // 审批流程设置
  'approval_flow.view': ['CEO', 'RND_MANAGER'],
  'approval_flow.update': ['CEO'],
  // 销售订单
  'sales_order.view': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION'],
  'sales_order.create': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'sales_order.update': ['CEO', 'FINANCE', 'RND_MANAGER', 'PURCHASER'],
  'sales_order.delete': ['CEO'],
  // 代工管理
  'oem.view': ['CEO', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION'],
  'oem.create': ['CEO', 'RND_MANAGER', 'PURCHASER'],
  'oem.update': ['CEO', 'RND_MANAGER', 'PURCHASER'],
  'oem.delete': ['CEO'],
  // 全局搜索
  'search.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE'],
  // 预警
  'alert.view': ['CEO', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE'],
  // 仪表板
  'dashboard.view': ['CEO', 'RND_MANAGER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE', 'DEVELOPER'],
  // 文件管理
  'file.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE'],
  'file.upload': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE'],
  'file.update': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE'],
  'file.delete': ['CEO', 'RND_MANAGER'],
  // 通用里程碑
  'milestone.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE'],
  'milestone.update': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'COMPLIANCE'],
  'milestone.delete': ['CEO', 'RND_MANAGER'],
  // 个人资料（自己可查看和修改）
  'profile.view': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE', 'OBSERVER'],
  'profile.update': ['CEO', 'RND_MANAGER', 'DEVELOPER', 'PURCHASER', 'PRODUCTION', 'FINANCE', 'COMPLIANCE', 'OBSERVER'],
  // 权限管理
  'user.permission': ['CEO'],
}

/**
 * 验证用户是否有权限执行指定操作
 * 优先检查用户级权限覆盖（UserPermission），若无覆盖则走角色判断
 * 
 * @param role 用户角色
 * @param operation 操作名称（如 'formula.create'）
 * @param userId 可选。传入 userId 时会检查该用户的权限覆盖表
 * @returns 是否有权限
 */
export async function verifyPermission(role: string, operation: string, userId?: string): Promise<boolean> {
  // CEO 拥有所有权限（除非被用户级覆盖拒绝，但 CEO 不能修改自己的覆盖，所以放行）
  if (role === 'CEO') return true

  // 如果传入了 userId，先查用户级权限覆盖
  if (userId) {
    try {
      const override = await prisma.userPermission.findUnique({
        where: { userId_operation: { userId, operation } },
      })
      if (override) {
        return override.granted  // true = 允许, false = 拒绝
      }
    } catch {
      // 数据库查询失败时降级到角色判断
    }
  }

  const allowedRoles = OPERATION_ROLES[operation]
  if (!allowedRoles) {
    // 未定义的操作默认仅限 CEO
    return false
  }
  return allowedRoles.includes(role)
}

/**
 * 验证用户角色层级是否足够
 * @param role 用户角色
 * @param minRole 最低要求角色
 * @returns 是否有权限
 */
export function verifyRoleHierarchy(role: string, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[role] ?? -1
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 99
  return userLevel >= requiredLevel
}

/**
 * 计算用户当前可见的全部操作列表（供前端菜单/按钮过滤）
 * 规则：CEO 全量；普通角色取 OPERATION_ROLES 中角色命中项，再应用 UserPermission 覆盖（拒绝移除、允许补充）
 */
export async function getUserPermissionList(user: { id: string; role: string }): Promise<string[]> {
  if (user.role === 'CEO') return Object.keys(OPERATION_ROLES)

  const granted = new Set<string>()
  for (const [op, roles] of Object.entries(OPERATION_ROLES)) {
    if (roles.includes(user.role)) granted.add(op)
  }

  // 应用用户级覆盖（仅当表存在时；查询失败降级为角色默认）
  try {
    const overrides = await prisma.userPermission.findMany({
      where: { userId: user.id },
      select: { operation: true, granted: true },
    })
    for (const o of overrides) {
      if (o.granted) granted.add(o.operation)
      else granted.delete(o.operation)
    }
  } catch {
    // 忽略覆盖查询失败，使用角色默认
  }

  return [...granted]
}
