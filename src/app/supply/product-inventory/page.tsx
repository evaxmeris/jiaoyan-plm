'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  IN_STOCK: { label: '在库', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  USED: { label: '已使用', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  RETURNED: { label: '已退回', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  EXPIRED: { label: '已过期', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  DAMAGED: { label: '已损坏', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

function getStatusInfo(status: string) {
  return STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' }
}

const STOCK_OUT_REASONS: Record<string, string> = {
  SALE: '销售',
  DAMAGE: '报损',
  GIFT: '赠送',
  OTHER: '其他',
}

interface BatchItem {
  id: string
  batchNo: string
  productionDate: string
  expireDate: string | null
  quantity: number
  minStock: number
  status: string
  registrationNo: string | null
  remark: string | null
  createdAt: string
  product: { id: string; name: string; brand: string | null }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function isNearExpiry(dateStr: string | null): boolean {
  if (!dateStr) return false
  const days = daysUntil(dateStr)
  return days >= 0 && days < 30
}

export default function ProductInventoryPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [items, setItems] = useState<BatchItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [page, setPage] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    productId: '',
    batchNo: '',
    productionDate: '',
    expireDate: '',
    quantity: '',
    minStock: '0',
    status: 'IN_STOCK',
    registrationNo: '',
    remark: '',
  })
  const defaultForm = {
    productId: '',
    batchNo: '',
    productionDate: '',
    expireDate: '',
    quantity: '',
    minStock: '0',
    status: 'IN_STOCK',
    registrationNo: '',
    remark: '',
  }
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // 出库对话框
  const [showStockOut, setShowStockOut] = useState(false)
  const [stockOutItem, setStockOutItem] = useState<BatchItem | null>(null)
  const [stockOutForm, setStockOutForm] = useState({ quantity: '', reason: 'SALE', remark: '' })
  const [stockOutSubmitting, setStockOutSubmitting] = useState(false)

  // 标记异常对话框
  const [showAnomaly, setShowAnomaly] = useState(false)
  const [anomalyItem, setAnomalyItem] = useState<BatchItem | null>(null)
  const [anomalyStatus, setAnomalyStatus] = useState('EXPIRED')
  const [anomalySubmitting, setAnomalySubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (search) params.set('q', search)
      if (statusFilter) params.set('status', statusFilter)
      if (lowStockOnly) params.set('lowStock', 'true')

      const res = await apiFetch(`/api/supply/product-inventory?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setItems(data.data || data.items || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch (e: any) {
      if (!isUnauthorizedError(e)) showToast('error', e.message || '加载产品库存失败')
    }
    setLoading(false)
  }, [page, search, statusFilter, lowStockOnly, showToast])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 加载产品列表
  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/rnd/products?limit=200')
      const data = await res.json()
      if (res.ok) setProducts(data.data || data.productDesigns || [])
    } catch {}
  }, [])

  useEffect(() => { fetchProducts().catch(() => {}) }, [fetchProducts])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setShowForm(true)
  }

  const openEdit = (item: BatchItem) => {
    setEditingId(item.id)
    setForm({
      productId: item.product?.id || '',
      batchNo: item.batchNo || '',
      productionDate: item.productionDate ? item.productionDate.slice(0, 10) : '',
      expireDate: item.expireDate ? item.expireDate.slice(0, 10) : '',
      quantity: item.quantity?.toString() || '',
      minStock: item.minStock?.toString() || '0',
      status: item.status || 'IN_STOCK',
      registrationNo: item.registrationNo || '',
      remark: item.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const url = editingId ? `/api/supply/product-inventory/${editingId}` : '/api/supply/product-inventory'
    const method = editingId ? 'PUT' : 'POST'
    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setEditingId(null)
        showToast('success', editingId ? '更新成功' : '入库成功')
        fetchData()
      } else {
        const err = await res.json()
        showToast('error', err.error || (editingId ? '更新失败' : '入库失败'))
      }
    } catch {
      showToast('error', '网络错误')
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    try {
      const res = await apiFetch(`/api/supply/product-inventory/${confirmDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        showToast('error', err.error || '删除失败')
      } else {
        showToast('success', '删除成功')
      }
    } catch {
      showToast('error', '网络错误')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  // ─── 出库 ────────────────
  const openStockOut = (item: BatchItem) => {
    setStockOutItem(item)
    setStockOutForm({ quantity: '', reason: 'SALE', remark: '' })
    setShowStockOut(true)
  }

  const handleStockOut = async () => {
    if (!stockOutItem) return
    const qty = parseInt(stockOutForm.quantity)
    if (!qty || qty < 1) { showToast('error', '出库数量必须大于 0'); return }
    if (qty > stockOutItem.quantity) { showToast('error', '出库数量不能超过当前库存'); return }
    setStockOutSubmitting(true)
    try {
      const res = await apiFetch(`/api/supply/product-inventory/${stockOutItem.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qty,
          reason: stockOutForm.reason,
          remark: stockOutForm.remark || null,
        }),
      })
      if (res.ok) {
        showToast('success', '出库成功')
        setShowStockOut(false)
        setStockOutItem(null)
        fetchData()
      } else {
        const err = await res.json()
        showToast('error', err.error || '出库失败')
      }
    } catch {
      showToast('error', '网络错误')
    }
    setStockOutSubmitting(false)
  }

  // ─── 标记异常 ────────────────
  const openAnomaly = (item: BatchItem) => {
    setAnomalyItem(item)
    setAnomalyStatus('EXPIRED')
    setShowAnomaly(true)
  }

  const handleAnomaly = async () => {
    if (!anomalyItem) return
    setAnomalySubmitting(true)
    try {
      const res = await apiFetch(`/api/supply/product-inventory/${anomalyItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: anomalyStatus }),
      })
      if (res.ok) {
        showToast('success', '状态更新成功')
        setShowAnomaly(false)
        setAnomalyItem(null)
        fetchData()
      } else {
        const err = await res.json()
        showToast('error', err.error || '状态更新失败')
      }
    } catch {
      showToast('error', '网络错误')
    }
    setAnomalySubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">产品库存</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 入库</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 搜索+筛选 */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="text"
            placeholder="搜索产品名称 / 批号..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-card)]"
          >
            <option value="">全部状态</option>
            <option value="IN_STOCK">在库</option>
            <option value="USED">已使用</option>
            <option value="RETURNED">已退回</option>
            <option value="EXPIRED">已过期</option>
            <option value="DAMAGED">已损坏</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={e => { setLowStockOnly(e.target.checked); setPage(1) }}
              className="rounded border-[var(--color-border)]"
            />
            仅低库存
          </label>
        </div>

        {/* 新增/编辑弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑产品批次' : '产品入库'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">产品 *</label>
                  <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">选择产品</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">批次号 *</label>
                  <input type="text" value={form.batchNo} onChange={e => setForm({...form, batchNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">生产日期 *</label>
                  <input type="date" value={form.productionDate} onChange={e => setForm({...form, productionDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">保质期至</label>
                  <input type="date" value={form.expireDate} onChange={e => setForm({...form, expireDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">数量 *</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">预警阈值</label>
                  <input type="number" min="0" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">状态</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="IN_STOCK">在库</option>
                    <option value="USED">已使用</option>
                    <option value="RETURNED">已退回</option>
                    <option value="EXPIRED">已过期</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备案/注册号</label>
                  <input type="text" value={form.registrationNo} onChange={e => setForm({...form, registrationNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                  disabled={!form.productId || !form.batchNo || !form.productionDate || !form.quantity}
                >
                  {editingId ? '保存修改' : '入库'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 出库弹窗 */}
        {showStockOut && stockOutItem && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowStockOut(false); setStockOutItem(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">出库</h2>
              <div className="mb-3 text-sm text-[var(--color-text-secondary)]">
                批次: <span className="font-mono">{stockOutItem.batchNo}</span>
                &nbsp;|&nbsp;当前库存: <span className="font-semibold">{stockOutItem.quantity}</span>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">出库数量 *</label>
                  <input
                    type="number"
                    min="1"
                    max={stockOutItem.quantity}
                    value={stockOutForm.quantity}
                    onChange={e => setStockOutForm({...stockOutForm, quantity: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                    placeholder={`最大 ${stockOutItem.quantity}`}
                  />
                  {stockOutForm.quantity && parseInt(stockOutForm.quantity) > stockOutItem.quantity && (
                    <p className="text-red-500 text-xs mt-1">不能超过当前库存</p>
                  )}
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">出库原因 *</label>
                  <select
                    value={stockOutForm.reason}
                    onChange={e => setStockOutForm({...stockOutForm, reason: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    {Object.entries(STOCK_OUT_REASONS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea
                    value={stockOutForm.remark}
                    onChange={e => setStockOutForm({...stockOutForm, remark: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  onClick={() => { setShowStockOut(false); setStockOutItem(null) }}
                  className="px-4 py-2 text-[var(--color-text-secondary)] text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleStockOut}
                  disabled={!stockOutForm.quantity || parseInt(stockOutForm.quantity) < 1 || parseInt(stockOutForm.quantity) > stockOutItem.quantity || stockOutSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40"
                >
                  {stockOutSubmitting ? '提交中...' : '确认出库'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 标记异常弹窗 */}
        {showAnomaly && anomalyItem && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowAnomaly(false); setAnomalyItem(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">标记异常状态</h2>
              <div className="mb-3 text-sm text-[var(--color-text-secondary)]">
                批次: <span className="font-mono">{anomalyItem.batchNo}</span>
                &nbsp;|&nbsp;当前: <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusInfo(anomalyItem.status).color}`}>
                  {getStatusInfo(anomalyItem.status).label}
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">标记为 *</label>
                  <select
                    value={anomalyStatus}
                    onChange={e => setAnomalyStatus(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="EXPIRED">已过期</option>
                    <option value="DAMAGED">已损坏</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  onClick={() => { setShowAnomaly(false); setAnomalyItem(null) }}
                  className="px-4 py-2 text-[var(--color-text-secondary)] text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleAnomaly}
                  disabled={anomalySubmitting}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-40"
                >
                  {anomalySubmitting ? '提交中...' : '确认标记'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 表格 */}
        {loading ? (
          <div className="space-y-3 p-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-20" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div className="empty-state-title">暂无产品库存记录</div>
            <div className="empty-state-desc">点击右上角"入库"添加产品库存批次</div>
          </div>
        ) : (
          <>
            <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)] border-b">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">产品名称</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">批号</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">生产日期</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">保质期至</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">数量</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">预警阈值</th>
                    <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">状态</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">备注</th>
                    <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i: BatchItem) => {
                    const statusInfo = getStatusInfo(i.status)
                    const isLowStock = i.minStock > 0 && i.quantity <= i.minStock
                    const nearExpiry = isNearExpiry(i.expireDate)
                    return (
                      <tr
                        key={i.id}
                        className={`border-b last:border-0 hover:bg-[var(--color-bg)] ${isLowStock ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium">
                          {isLowStock && <span className="inline-block mr-1" title="库存不足">⚠️</span>}
                          {i.product?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">{i.batchNo}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {new Date(i.productionDate).toLocaleDateString('zh-CN')}
                        </td>
                        <td className={`px-4 py-3 text-xs ${nearExpiry ? 'bg-yellow-100 dark:bg-yellow-900/30 rounded' : ''}`}>
                          {i.expireDate ? (
                            <span className="inline-flex items-center gap-1">
                              {new Date(i.expireDate).toLocaleDateString('zh-CN')}
                              {nearExpiry && (
                                <span className="text-yellow-700 dark:text-yellow-400 font-medium text-[10px]">临期</span>
                              )}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {isLowStock ? <span className="text-red-600 font-bold">⚠️ {i.quantity}</span> : i.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                          {i.minStock || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] max-w-[120px] truncate">
                          {i.remark || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button onClick={() => openEdit(i)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                            <button onClick={() => openStockOut(i)} className="px-2 py-1 text-xs border rounded text-blue-600 hover:bg-blue-50">出库</button>
                            {i.status === 'IN_STOCK' && (
                              <button onClick={() => openAnomaly(i)} className="px-2 py-1 text-xs border rounded text-orange-600 hover:bg-orange-50">标记异常</button>
                            )}
                            <button onClick={() => handleDelete(i.id)} className="px-2 py-1 text-xs border rounded text-red-500 hover:bg-red-50">删除</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border rounded text-[var(--color-text-secondary)] disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border rounded text-[var(--color-text-secondary)] disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此产品批次记录吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
