'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ClipboardList, Search, ChevronLeft, ChevronRight,
  Loader2, Calendar, Filter,
} from 'lucide-react'

// ── 类型 ──
interface AuditLogEntry {
  id: string
  userId: string | null
  userName: string | null
  action: string
  entity: string
  entityId: string | null
  detail: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface AuditLogResponse {
  logs: AuditLogEntry[]
  pagination: Pagination
}

// ── 操作类型中文映射 ──
const ACTION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  LOGIN: '登录',
  EXPORT: '导出',
  APPROVE: '审批',
  REJECT: '驳回',
  SUBMIT: '提交',
  UPLOAD: '上传',
  DOWNLOAD: '下载',
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  EXPORT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  SUBMIT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  UPLOAD: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  DOWNLOAD: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

// ── 时间范围预设 ──
type TimeRange = 'today' | 'week' | 'month' | 'custom'

function getDateRange(range: TimeRange): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  let start: string

  switch (range) {
    case 'today':
      start = end
      break
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay())
      start = d.toISOString().slice(0, 10)
      break
    }
    case 'month':
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      break
    default:
      start = end
  }
  return { start, end }
}

// ── 操作类型选项 ──
const ACTION_OPTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'APPROVE', 'REJECT', 'SUBMIT', 'UPLOAD', 'DOWNLOAD']

// ── 实体 ──
const ENTITY_OPTIONS = ['', 'Formula', 'Material', 'Product', 'Sample', 'User', 'Supplier', 'Inspection', 'Registration', 'Contract', 'Batch', 'Costing', 'Trademark', 'Patent']

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── 筛选状态 ──
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // ── 构建参数 ──
  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', '50')

    if (timeRange === 'custom' && customStart) {
      params.set('startDate', customStart)
      if (customEnd) params.set('endDate', customEnd)
    } else if (timeRange !== 'custom') {
      const { start, end } = getDateRange(timeRange)
      params.set('startDate', start)
      params.set('endDate', end)
    }

    if (actionFilter) params.set('action', actionFilter)
    if (entityFilter) params.set('entity', entityFilter)
    if (search.trim()) params.set('search', search.trim())

    return params
  }, [page, timeRange, customStart, customEnd, actionFilter, entityFilter, search])

  // ── 数据加载 ──
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = buildParams()
      const res = await fetch(`/api/audit-log?${params}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `请求失败 (${res.status})`)
      }
      const data: AuditLogResponse = await res.json()
      setLogs((data as any).data || data.logs)
      setPagination((data as any).meta || data.pagination)
    } catch (e: any) {
      setError(e.message || '加载审计日志失败')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // ── 翻页 ──
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    setPage(newPage)
  }

  // ── 格式化表格摘要 ──
  const formatSummary = (entry: AuditLogEntry): string => {
    const d = entry.detail
    if (!d) return entry.entityId || '—'
    const keys = Object.keys(d)
    if (keys.length === 0) return entry.entityId || '—'
    const firstKey = keys[0]
    const val = d[firstKey]
    const valStr = typeof val === 'string' ? val : JSON.stringify(val)
    if (keys.length === 1) return `${firstKey}: ${valStr}`
    return `${firstKey}: ${valStr} 等 ${keys.length} 项`
  }

  // ── 渲染 ──
  return (
    <div className="w-full mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-2 mb-6">
        <ClipboardList className="w-6 h-6 text-emerald-500" />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">审计日志</h1>
      </div>

      {/* 筛选栏 */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 时间范围 */}
          <div className="min-w-0">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              时间范围
            </label>
            <div className="flex flex-wrap gap-1">
              {([['today', '今天'], ['week', '本周'], ['month', '本月'], ['custom', '自定义']] as [TimeRange, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setTimeRange(key); setPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    timeRange === key
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-[var(--color-text-secondary)] hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {timeRange === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => { setCustomStart(e.target.value); setPage(1) }}
                  className="px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-transparent"
                />
                <span className="text-xs text-[var(--color-text-secondary)]">至</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value); setPage(1) }}
                  className="px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-transparent"
                />
              </div>
            )}
          </div>

          {/* 操作类型 */}
          <div className="min-w-0">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              操作类型
            </label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1) }}
              className="px-2.5 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-transparent text-[var(--color-text-primary)]"
            >
              <option value="">全部</option>
              {ACTION_OPTIONS.filter(Boolean).map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>
          </div>

          {/* 实体类型 */}
          <div className="min-w-0">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              实体类型
            </label>
            <select
              value={entityFilter}
              onChange={e => { setEntityFilter(e.target.value); setPage(1) }}
              className="px-2.5 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-transparent text-[var(--color-text-primary)]"
            >
              <option value="">全部</option>
              {ENTITY_OPTIONS.filter(Boolean).map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* 用户搜索 */}
          <div className="min-w-0 flex-1 max-w-xs">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              <Search className="w-3 h-3 inline mr-1" />
              用户搜索
            </label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchLogs() } }}
              placeholder="输入用户名搜索..."
              className="w-full px-2.5 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-transparent text-[var(--color-text-primary)] placeholder:text-zinc-400"
            />
          </div>

          {/* 搜索按钮 */}
          <button
            onClick={() => { setPage(1); fetchLogs() }}
            className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
          >
            <Search className="w-3.5 h-3.5 inline mr-1" />
            搜索
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* 错误状态 */}
      {!loading && error && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <p className="text-red-500 mb-4 text-sm">{error}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm hover:bg-emerald-600 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 表格 */}
      {!loading && !error && (
        <>
          {/* 统计信息 */}
          <div className="text-xs text-[var(--color-text-secondary)] mb-2">
            共 {pagination.total} 条记录，当前第 {pagination.page}/{pagination.totalPages} 页
          </div>

          {logs.length === 0 ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <div className="text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                <p className="text-[var(--color-text-secondary)] text-sm">暂无审计日志记录</p>
              </div>
            </div>
          ) : (
            <>
              {/* 桌面表格 */}
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">时间</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">用户</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">操作</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">实体</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">详情摘要</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {logs.map(entry => (
                      <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span className="font-medium text-[var(--color-text-primary)]">{entry.userName || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            ACTION_COLORS[entry.action] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}>
                            {ACTION_LABELS[entry.action] || entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-primary)] whitespace-nowrap">
                          <span className="font-mono">{entry.entity}</span>
                          {entry.entityId && (
                            <span className="text-[var(--color-text-secondary)] ml-1">#{entry.entityId.slice(0, 8)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] max-w-xs truncate">
                          {formatSummary(entry)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 移动端卡片 */}
              <div className="space-y-2 md:hidden">
                {logs.map(entry => (
                  <div key={entry.id} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ACTION_COLORS[entry.action] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(entry.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-medium text-[var(--color-text-primary)]">{entry.userName || '—'}</span>
                      <span className="text-[var(--color-text-secondary)]">·</span>
                      <span className="font-mono text-[var(--color-text-primary)]">{entry.entity}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                      {formatSummary(entry)}
                    </p>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {generatePageButtons(pagination.page, pagination.totalPages).map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-[var(--color-text-secondary)]">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p as number)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          page === p
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-[var(--color-text-secondary)] hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="p-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── 分页按钮生成 ──
function generatePageButtons(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = []
  pages.push(1)

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}
