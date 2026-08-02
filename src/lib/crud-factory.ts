/**
 * 通用 CRUD 路由工厂
 *
 * 消除 112 个 API 路由中 70% 的重复模板代码。
 *
 * 用法（route.ts）：
 * ```typescript
 * import { createCrudHandlers } from '@/lib/crud-factory'
 *
 * export const { GET, POST } = createCrudHandlers({
 *   model: 'rawMaterial',
 *   permissions: { view: 'material.view', create: 'material.create', update: 'material.update', delete: 'material.delete' },
 *   searchFields: ['nameCn', 'casNo', 'supplier'],
 *   include: { supplier: { select: { name: true } } },
 *   orderBy: { createdAt: 'desc' },
 * })
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'

// ─── 类型定义 ────────────────

type PrismaModel = typeof prisma[keyof typeof prisma]

interface CrudConfig<T = any> {
  /** Prisma 模型名（小驼峰，如 'rawMaterial'） */
  model: keyof typeof prisma
  /** 权限名 */
  permissions: {
    view: string
    create: string
    update: string
    delete: string
    approve?: string
  }
  /** 列表查询时默认包含的关联 */
  include?: any
  /** 详情查询时额外包含的关联（默认用 include） */
  detailInclude?: any
  /** 默认排序 */
  orderBy?: any
  /** 可搜索字段（用于 GET?search=xxx 模糊查询） */
  searchFields?: string[]
  /** 创建前的预处理 */
  beforeCreate?: (body: any, user: { id: string; name: string; role: string }) => any
  /** 更新前的预处理 */
  beforeUpdate?: (body: any, old: any, user: { id: string; name: string; role: string }) => any
  /** 允许的排序字段白名单 */
  sortableFields?: string[]
  /** 软删除字段名（默认不启用软删除） */
  softDeleteField?: string
  /** 是否启用分页（默认 true） */
  paginate?: boolean
  /** 默认每页条数 */
  defaultLimit?: number
  /** 最大每页条数 */
  maxLimit?: number
}

// ─── Helper: 构建 Prisma where 条件 ───

function buildWhere(config: CrudConfig, searchParams: URLSearchParams): any {
  const where: any = { isDeleted: config.softDeleteField ? false : undefined }

  // 精确过滤：?status=ACTIVE → { status: 'ACTIVE' }
  for (const [key, value] of searchParams.entries()) {
    if (key === 'search' || key === 'page' || key === 'limit' || key === 'sort' || key === 'order') continue
    if (value) where[key] = value
  }

  // 模糊搜索：?search=xxx
  const search = searchParams.get('search')
  if (search && config.searchFields?.length) {
    where.OR = config.searchFields.map(field => ({
      [field]: { contains: search, mode: 'insensitive' },
    }))
  }

  return where
}

function buildOrderBy(config: CrudConfig, searchParams: URLSearchParams): any {
  const sort = searchParams.get('sort')
  const order = searchParams.get('order') || 'desc'
  if (sort && config.sortableFields?.includes(sort)) {
    return { [sort]: order }
  }
  return config.orderBy || { createdAt: 'desc' }
}

// ─── 核心工厂 ────────────────

export function createCrudHandlers(config: CrudConfig) {
  const paginate = config.paginate ?? true
  const defaultLimit = config.defaultLimit ?? 20
  const maxLimit = config.maxLimit ?? 100

  /**
   * GET — 列表查询
   * 支持: ?page=1&limit=20&status=ACTIVE&search=xxx&sort=name&order=asc
   */
  async function GET(req: NextRequest) {
    const user = await verifyAuth()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
    if (!await verifyPermission(user.role, config.permissions.view, user.id)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const url = new URL(req.url)
    const { searchParams } = url

    // 详情路由：?id=xxx 或路径参数
    const id = searchParams.get('id')

    if (id) {
      // 获取单条记录
      const record = await (prisma as any)[config.model].findUnique({
        where: { id },
        include: config.detailInclude || config.include,
      })
      if (!record) return NextResponse.json({ error: '记录不存在' }, { status: 404 })
      return NextResponse.json({ success: true, data: record, [config.model]: record })
    }

    // 列表查询
    const page = paginate ? Math.max(1, parseInt(searchParams.get('page') || '1')) : 1
    const limit = paginate ? Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit)))) : 9999
    const skip = paginate ? (page - 1) * limit : 0
    const where = buildWhere(config, searchParams)
    const orderBy = buildOrderBy(config, searchParams)

    const [items, total] = await Promise.all([
      (prisma as any)[config.model].findMany({ where, include: config.include, orderBy, skip, take: limit }),
      (prisma as any)[config.model].count({ where }),
    ])

    const paginationData = paginate ? { page, limit, total, totalPages: Math.ceil(total / limit) } : undefined
    return NextResponse.json({
      success: true,
      data: items,
      meta: paginationData,
      [String(config.model) + 's']: items,
      pagination: paginationData,
    })
  }

  /**
   * POST — 创建记录
   */
  async function POST(req: NextRequest) {
    const user = await verifyAuth()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
    if (!await verifyPermission(user.role, config.permissions.create, user.id)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    let body: any
    try { body = await req.json() } catch { body = {} }

    try {
      const data = config.beforeCreate ? config.beforeCreate(body, user) : body

      const record = await (prisma as any)[config.model].create({ data, include: config.include })

      // 审计日志
      const { writeAuditLog, extractIp } = await import('@/lib/audit')
      await writeAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'CREATE',
        entity: config.model as string,
        entityId: record.id,
        detail: { name: record.name || record.title || record.nameCn || record.id },
        ip: extractIp(req),
      })

      return NextResponse.json({ success: true, data: record, [config.model]: record }, { status: 201 })
    } catch (err: any) {
      // 校验失败（beforeCreate 抛错）→ 400；其他 → 500
      const msg = err?.message || '创建失败'
      const isValidation = msg.includes('Invalid option') || msg.includes('不能为空') || msg.includes('Invalid') || msg.includes('expected')
      return NextResponse.json({ success: false, error: msg }, { status: isValidation ? 400 : 500 })
    }
  }

  /**
   * PUT — 更新记录
   */
  async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await verifyAuth()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
    if (!await verifyPermission(user.role, config.permissions.update, user.id)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { id } = await params
    const old = await (prisma as any)[config.model].findUnique({ where: { id } })
    if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

    let body: any
    try { body = await req.json() } catch { body = {} }

    try {
      const record = await (prisma as any)[config.model].update({ where: { id }, data: body, include: config.include })

      const { writeAuditLog, extractIp } = await import('@/lib/audit')
      await writeAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'UPDATE',
        entity: config.model as string,
        entityId: id,
        detail: { changes: Object.keys(body).slice(0, 10) },
        ip: extractIp(req),
      })

      return NextResponse.json({ success: true, data: record, [config.model]: record })
    } catch (err: any) {
      const msg = err?.message || '更新失败'
      const isValidation = msg.includes('Invalid option') || msg.includes('不能为空') || msg.includes('Invalid') || msg.includes('expected')
      return NextResponse.json({ success: false, error: msg }, { status: isValidation ? 400 : 500 })
    }
  }

  /**
   * DELETE — 删除记录
   */
  async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await verifyAuth()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
    if (!await verifyPermission(user.role, config.permissions.delete, user.id)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { id } = await params
    const old = await (prisma as any)[config.model].findUnique({ where: { id } })
    if (!old) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

    if (config.softDeleteField) {
      await (prisma as any)[config.model].update({
        where: { id },
        data: { [config.softDeleteField]: true, deletedAt: new Date() },
      })
    } else {
      await (prisma as any)[config.model].delete({ where: { id } })
    }

    const { writeAuditLog, extractIp } = await import('@/lib/audit')
    await writeAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'DELETE',
      entity: config.model as string,
      entityId: id,
      detail: { name: old.name || old.title || old.nameCn || id },
      ip: extractIp(req),
    })

    return NextResponse.json({ success: true, data: null })
  }

  return { GET, POST, PUT, DELETE }
}

/**
 * PUT/DELETE 路由工厂（用于 [id]/route.ts）
 * 因为 GET 可能和列表路由冲突，拆成单独的函数
 */
export function createDetailHandlers(config: CrudConfig) {
  const { PUT, DELETE } = createCrudHandlers(config)
  async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await verifyAuth()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
    if (!await verifyPermission(user.role, config.permissions.view, user.id)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { id } = await params
    const record = await (prisma as any)[config.model].findUnique({
      where: { id },
      include: config.detailInclude || config.include,
    })
    if (!record) return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    return NextResponse.json({ success: true, data: record, [config.model]: record })
  }

  return { GET, PUT, DELETE }
}
