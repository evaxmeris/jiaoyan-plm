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

/** 已审批采购申请（可生成 PO 的候选） */
interface ApprovedApplication {
  id: string
  code: string
  title: string
  supplier: string | null
  totalAmount: number
  status: string
  items: { id: string; name: string; quantity: number; unit: string }[]
  purchaseOrder?: { id: string; poNo: string; status: string } | null
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
  const [form, setForm] = useState({ applicationId: '', remark: '' })
  // 已审批采购申请（生成 PO 的候选来源）
  const [applications, setApplications] = useState<ApprovedApplication[]>([])
  // 新建时当前选中的申请（用于展示摘要）
  const [selectedApp, setSelectedApp] = useState<ApprovedApplication | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // 加载已审批且尚未生成 PO 的采购申请
  useEffect(() => {
    apiFetch('/api/purchase/applications?status=APPROVED&limit=100')
      .then(r => r.json())
      .then(j => {
        const list = j.applications || j.data?.applications || []
        setApplications(list)
      })
      .catch(() => { /* 申请列表加载失败不阻塞页面 */ })
  }, [])

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
    setForm({ applicationId: '', remark: '' })
    setSelectedApp(null)
    setShowForm(true)
  }

  const openView = (o: PurchaseOrder) => {
    setEditingId(o.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.applicationId) {
      showToast('error', '请选择要生成订单的采购申请')
      return
    }
    const res = await apiFetch('/api/purchase/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: form.applicationId, remark: form.remark || undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      const order = data.order || data.data?.order
      showToast('success', order?.poNo ? `采购订单 ${order.poNo} 已生成` : '采购订单已生成')
      setShowForm(false)
      setEditingId(null)
      setForm({ applicationId: '', remark: '' })
      setSelectedApp(null)
      fetchOrders(pagination.page)
    } else {
      const data = await res.json()
      showToast('error', data.error || '创建失败')
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
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between">
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
              {editingId ? (
                /* ── 查看订单详情（只读，后端无编辑接口） ── */
                <>
                  <h2 className="text-lg font-semibold mb-4">采购订单详情</h2>
                  {(() => {
                    const o = orders.find(x => x.id === editingId)
                    if (!o) return <p className="text-sm text-[var(--color-text-secondary)]">订单不存在</p>
                    return (
                      <div className="text-sm space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><div className="text-[var(--color-text-secondary)] text-xs">PO 编号</div><div className="font-medium">{o.poNo}</div></div>
                          <div><div className="text-[var(--color-text-secondary)] text-xs">状态</div><span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[o.status] || o.status}</span></div>
                          <div><div className="text-[var(--color-text-secondary)] text-xs">供应商</div><div className="font-medium">{o.supplierName}</div></div>
                          <div><div className="text-[var(--color-text-secondary)] text-xs">订单金额</div><div className="font-medium">¥{Number(o.totalAmount).toFixed(2)}</div></div>
                          <div><div className="text-[var(--color-text-secondary)] text-xs">来源申请</div><div>{o.application?.code} · {o.application?.title}</div></div>
                        </div>
                        {(o.items?.length > 0) && (
                          <div>
                            <div className="text-[var(--color-text-secondary)] text-xs mb-1">订单明细</div>
                            <div className="border rounded-lg divide-y">
                              {o.items.map(it => (
                                <div key={it.id} className="flex justify-between px-3 py-1.5 text-xs">
                                  <span>{it.name}</span>
                                  <span className="text-[var(--color-text-secondary)]">{it.quantity}{it.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {o.remark && <div><div className="text-[var(--color-text-secondary)] text-xs">备注</div><div>{o.remark}</div></div>}
                      </div>
                    )
                  })()}
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">关闭</button>
                  </div>
                </>
              ) : (
                /* ── 新建：从已审批采购申请生成 PO ── */
                <>
                  <h2 className="text-lg font-semibold mb-4">新建采购订单</h2>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">采购申请 *（需已审批通过）</label>
                      <select
                        value={form.applicationId}
                        onChange={e => {
                          const app = applications.find(a => a.id === e.target.value) || null
                          setForm({ ...form, applicationId: e.target.value })
                          setSelectedApp(app)
                        }}
                        className="w-full px-3 py-1.5 border rounded text-sm bg-white"
                      >
                        <option value="">请选择采购申请</option>
                        {applications
                          .filter(a => !a.purchaseOrder) // 已生成 PO 的申请不可再选
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} · {a.title}{a.supplier ? ` · ${a.supplier}` : ''}（¥{Number(a.totalAmount).toFixed(2)}）
                            </option>
                          ))}
                      </select>
                      {applications.filter(a => !a.purchaseOrder).length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">暂无已审批通过的采购申请，请先在采购管理创建申请并完成审批</p>
                      )}
                    </div>
                    {selectedApp && (
                      <div className="bg-[var(--color-bg)] rounded-lg p-3 text-xs space-y-1">
                        <div className="font-medium">{selectedApp.title}</div>
                        <div className="text-[var(--color-text-secondary)]">编号：{selectedApp.code} ｜ 供应商：{selectedApp.supplier || '未指定'}</div>
                        <div className="text-[var(--color-text-secondary)]">金额：¥{Number(selectedApp.totalAmount).toFixed(2)} ｜ 明细：{selectedApp.items?.length || 0} 项</div>
                        <div className="text-[var(--color-text-secondary)]">生成后自动带出明细与金额，PO 编号自动分配</div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={3} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.applicationId}>生成采购订单</button>
                  </div>
                </>
              )}
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
                        onClick={() => openView(o)}
                        className="px-2.5 py-1 rounded text-xs border text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
                      >
                        查看
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
