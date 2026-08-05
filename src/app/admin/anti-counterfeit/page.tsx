'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, Plus, Download, Trash2, Search, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface AntiCounterfeitCode {
  id: string
  code: string
  productBatchId: string | null
  productId: string | null
  status: 'ACTIVE' | 'VERIFIED' | 'EXPIRED' | 'REVOKED'
  firstVerifiedAt: string | null
  firstVerifiedIp: string | null
  verifyCount: number
  createdAt: string
  expiredAt: string | null
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '生效中',
  VERIFIED: '已验证',
  EXPIRED: '已过期',
  REVOKED: '已作废',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  VERIFIED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REVOKED: 'bg-red-100 text-red-600',
}

interface Stats {
  total: number
  active: number
  verified: number
  expired: number
  revoked: number
}

export default function AntiCounterfeitAdminPage() {
  const [codes, setCodes] = useState<AntiCounterfeitCode[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, verified: 0, expired: 0, revoked: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateForm, setGenerateForm] = useState({ count: 100, prefix: 'AC', productBatchId: '' })
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const pageSize = 20
  const { showToast } = useToast()

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
      if (statusFilter) params.set('status', statusFilter)
      if (keyword) params.set('keyword', keyword)
      const res = await apiFetch(`/api/anti-counterfeit?${params}`)
      const data = await res.json()
      if (res.ok) {
        setCodes(data.data || data.codes || [])
        setTotal((data.meta || data.pagination || {}).total || data.total || 0)
        // 计算统计
        const allRes = await apiFetch('/api/anti-counterfeit?pageSize=1')
        const allData = await allRes.json()
        // 分别统计各状态数量
        const statusCounts = await Promise.all(
          ['ACTIVE', 'VERIFIED', 'EXPIRED', 'REVOKED'].map(async (s) => {
            const r = await apiFetch(`/api/anti-counterfeit?pageSize=1&status=${s}`)
            const d = await r.json()
            return (d.meta || {}).total || d.total || 0
          })
        )
        setStats({
          total: (allData.meta || {}).total || allData.total || 0,
          active: statusCounts[0],
          verified: statusCounts[1],
          expired: statusCounts[2],
          revoked: statusCounts[3],
        })
      }
    } catch {
      showToast('error', '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, keyword])

  useEffect(() => { fetchCodes().catch(() => {}) }, [fetchCodes])

  const handleGenerate = async () => {
    try {
      const res = await apiFetch('/api/anti-counterfeit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', `成功生成 ${data.data?.count ?? data.count ?? 0} 个防伪码`)
        setShowGenerate(false)
        fetchCodes()
      } else {
        showToast('error', data.error || '生成失败')
      }
    } catch {
      showToast('error', '生成失败')
    }
  }

  const handleBatchRevoke = async () => {
    if (selectedIds.size === 0) return
    setConfirmRevoke(true)
  }

  const doBatchRevoke = async () => {
    try {
      const res = await apiFetch('/api/anti-counterfeit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', `已作废 ${data.revokedCount} 个防伪码`)
        setSelectedIds(new Set())
        fetchCodes()
      } else {
        showToast('error', data.error || '操作失败')
      }
    } catch {
      showToast('error', '操作失败')
    }
  }

  const handleExportCsv = () => {
    if (codes.length === 0) return
    const headers = ['防伪码', '状态', '查询次数', '首次验证时间', '首次验证IP', '创建时间']
    const rows = codes.map(c => [
      c.code,
      STATUS_LABELS[c.status],
      c.verifyCount,
      c.firstVerifiedAt ? new Date(c.firstVerifiedAt).toLocaleString('zh-CN') : '',
      c.firstVerifiedIp || '',
      new Date(c.createdAt).toLocaleString('zh-CN'),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `防伪码_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === codes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(codes.map(c => c.id)))
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 w-full mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">防伪管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg
                       hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            生成防伪码
          </button>
          <button
            onClick={handleExportCsv}
            disabled={codes.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg
                       hover:bg-[var(--color-bg)] disabled:opacity-50 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchRevoke}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg
                         hover:bg-red-600 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              作废({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: '全部', key: 'total', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: '生效中', key: 'active', color: 'bg-green-50 text-green-700 border-green-200' },
          { label: '已验证', key: 'verified', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: '已过期', key: 'expired', color: 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]' },
          { label: '已作废', key: 'revoked', color: 'bg-red-50 text-red-600 border-red-200' },
        ].map(s => (
          <div key={s.key} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{stats[s.key as keyof Stats]}</div>
            <div className="text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-4 mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder="搜索防伪码..."
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">全部状态</option>
          <option value="ACTIVE">生效中</option>
          <option value="VERIFIED">已验证</option>
          <option value="EXPIRED">已过期</option>
          <option value="REVOKED">已作废</option>
        </select>
      </div>

      {/* 数据表格 */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <th className="w-10 px-4 py-3 text-left whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={codes.length > 0 && selectedIds.size === codes.length}
                    onChange={toggleAll}
                    className="rounded border-[var(--color-border)]"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap">防伪码</th>
                <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap">状态</th>
                <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap">查询次数</th>
                <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap">首次验证</th>
                <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap">有效期</th>
                <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--color-text-secondary)]">加载中...</td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--color-text-secondary)]">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    暂无数据
                  </td>
                </tr>
              ) : codes.map(code => (
                <tr key={code.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(code.id)}
                      onChange={() => toggleSelect(code.id)}
                      className="rounded border-[var(--color-border)]"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--color-text)] whitespace-nowrap">{code.code}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${STATUS_COLORS[code.status]}`}>
                      {STATUS_LABELS[code.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{code.verifyCount}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">
                    {code.firstVerifiedAt
                      ? new Date(code.firstVerifiedAt).toLocaleString('zh-CN')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">
                    {code.expiredAt
                      ? new Date(code.expiredAt).toLocaleDateString('zh-CN')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">
                    {new Date(code.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-text-secondary)]">共 {total} 条</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-[var(--color-bg)] disabled:opacity-50"
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, page - 2)
                const p = start + i
                if (p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 text-sm border rounded ${
                      p === page ? 'bg-emerald-600 text-white border-emerald-600' : 'hover:bg-[var(--color-bg)]'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-[var(--color-bg)] disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 生成弹窗 */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowGenerate(false)}>
          <div className="bg-[var(--color-card)] rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">生成防伪码</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">数量</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={generateForm.count}
                  onChange={e => setGenerateForm(f => ({ ...f, count: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">前缀</label>
                <input
                  type="text"
                  value={generateForm.prefix}
                  onChange={e => setGenerateForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                  maxLength={6}
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">前缀 + 15位随机数字 + 1位校验位</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">产品批次ID（可选）</label>
                <input
                  type="text"
                  value={generateForm.productBatchId}
                  onChange={e => setGenerateForm(f => ({ ...f, productBatchId: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowGenerate(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm hover:bg-[var(--color-bg)]"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
              >
                生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
