'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface PurchaseOrder {
 id: string
 poNo: string
 supplierName: string
 totalAmount: number
 status: string
  remark: string | null
 issuedAt: string | null
 confirmedAt: string | null
 createdAt: string
 items: { id: string; name: string; quantity: number; unit: string }[]
 application: { code: string; title: string }
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  ISSUED: '已发出',
  CONFIRMED: '已确认',
  PARTIAL: '部分到货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-500',
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ poNo: '', supplierName: '', remark: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchOrders = useCallback(async (page: number = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (statusFilter) params.set('status', statusFilter)
    if (keyword) params.set('keyword', keyword)

    const res = await apiFetch(`/api/purchase/orders?${params}`)
    const data = await res.json()
    setOrders(data.data || data.orders || [])
    setPagination(data.meta || data.pagination)
    setLoading(false)
  }, [statusFilter, keyword])

  useEffect(() => { fetchOrders(1) }, [fetchOrders])

  const openCreate = () => {
    setEditingId(null)
    setForm({ poNo: '', supplierName: '', remark: '' })
    setShowForm(true)
  }

  const openEdit = (o: PurchaseOrder) => {
    setEditingId(o.id)
    setForm({ poNo: o.poNo, supplierName: o.supplierName, remark: o.remark || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.poNo || !form.supplierName) return
    const url = editingId ? `/api/purchase/orders/${editingId}` : '/api/purchase/orders'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      setForm({ poNo: '', supplierName: '', remark: '' })
      fetchOrders(pagination.page)
    } else {
      const data = await res.json()
      showToast('error', data.error || (editingId ? '更新失败' : '创建失败'))
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/purchase/orders/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchOrders(pagination.page)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">采购订单</h1>
            {pagination.total > 0 && (
              <span className="text-xs text-[var(--color-text-secondary)]">共 {pagination.total} 条</span>
            )}
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建采购订单</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 筛选栏 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                !statusFilter ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
              }`}
            >
              全部
            </button>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  statusFilter === key ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <input
            type="text"
            placeholder="搜索PO编号/供应商..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="w-48 px-3 py-1.5 border rounded-lg text-xs"
          />
        </div>

        {/* 新建/编辑订单弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑采购订单' : '新建采购订单'}</h2>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">PO编号 *</label>
                  <input type="text" value={form.poNo} onChange={e => setForm({ ...form, poNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">供应商名称 *</label>
                  <input type="text" value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={3} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.poNo || !form.supplierName}>{editingId ? '保存修改' : '创建'}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => (
            <div key={i} className="bg-[var(--color-card)] rounded-xl border p-4">
              <div className="skeleton h-5 w-64 mb-2" />
              <div className="skeleton h-4 w-40" />
            </div>
          ))}</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <div className="empty-state-title">暂无采购订单</div>
            <div className="empty-state-desc">审批通过的采购申请可生成采购订单</div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map(o => (
                <div
                  key={o.id}
                  className="bg-[var(--color-card)] rounded-xl border p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/purchase/orders/${o.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[var(--color-text)]">{o.poNo}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[o.status] || ''}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {o.supplierName} · ¥{o.totalAmount.toFixed(2)} · {o.items.length} 项
                        {o.application?.title && <span> · {o.application.title}</span>}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        创建于 {new Date(o.createdAt).toLocaleString('zh-CN')}
                        {o.issuedAt && <> · 发出于 {new Date(o.issuedAt).toLocaleString('zh-CN')}</>}
                        {o.confirmedAt && <> · 确认于 {new Date(o.confirmedAt).toLocaleString('zh-CN')}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <span className="text-sm font-semibold text-rose-600">¥{o.totalAmount.toFixed(2)}</span>
                      <button
                        onClick={() => openEdit(o)}
                        className="px-2.5 py-1 rounded text-xs border text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
                      >
                        编辑
                      </button>
                      {o.status === 'DRAFT' && (
                        <button
                          onClick={() => handleDelete(o.id)}
                          className="px-2.5 py-1 rounded text-xs border text-red-500 hover:bg-red-50"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => fetchOrders(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-xs rounded border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg)]"
                >
                  上一页
                </button>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchOrders(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-xs rounded border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg)]"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此采购订单吗？只能删除草稿状态的订单。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
