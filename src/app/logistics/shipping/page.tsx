'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface SalesOrder {
  id: string
  orderNo: string
  productName: string
  quantity: number
  totalAmount: number
  status: string
  channel?: { name: string }
}

interface ShippingOrder {
  id: string
  salesOrderId: string
  shippingNo: string
  logisticsProvider: string | null
  trackingNo: string | null
  shippingDate: string | null
  estimatedDays: number | null
  deliveredDate: string | null
  status: string
  totalPackage: number | null
  weight: number | null
  volume: number | null
  shippingCost: number | null
  remark: string | null
  createdAt: string
  salesOrder: SalesOrder
}

interface LogisticsProvider {
  id: string
  name: string
  contact: string | null
  phone: string | null
  isActive: boolean
}

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  PENDING: '待拣货',
  PICKING: '拣货中',
  PACKED: '已打包',
  SHIPPED: '已发货',
  DELIVERED: '已签收',
  RETURNED: '已退回',
}

const SHIPPING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PICKING: 'bg-yellow-100 text-yellow-700',
  PACKED: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-purple-100 text-purple-600',
  DELIVERED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-red-100 text-red-500',
}

// 状态流转按钮配置
const STATUS_ACTIONS: Record<string, { label: string; target: string; color: string }[]> = {
  PENDING: [{ label: '开始拣货', target: 'PICKING', color: 'bg-yellow-500' }],
  PICKING: [{ label: '已打包', target: 'PACKED', color: 'bg-blue-500' }],
  PACKED: [{ label: '已发货', target: 'SHIPPED', color: 'bg-purple-500' }],
  SHIPPED: [
    { label: '已签收', target: 'DELIVERED', color: 'bg-green-500' },
    { label: '退回', target: 'RETURNED', color: 'bg-red-400' },
  ],
  DELIVERED: [],
  RETURNED: [],
}

const defaultForm = {
  salesOrderId: '',
  logisticsProvider: '',
  trackingNo: '',
  shippingDate: '',
  estimatedDays: '',
  totalPackage: '',
  weight: '',
  volume: '',
  shippingCost: '',
  remark: '',
}

export default function LogisticsShippingPage() {
  const [shippingOrders, setShippingOrders] = useState<ShippingOrder[]>([])
  const [confirmedOrders, setConfirmedOrders] = useState<SalesOrder[]>([])
  const [providers, setProviders] = useState<LogisticsProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [providerForm, setProviderForm] = useState({ id: '', name: '', contact: '', phone: '' })
  const router = useRouter()
  const { showToast } = useToast()

  const fetchShippingOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const res = await apiFetch(`/api/logistics/shipping?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (res.ok) setShippingOrders(data.data?.orders || data.orders || [])
    setLoading(false)
  }, [filterStatus])

  const fetchConfirmedOrders = useCallback(async () => {
    const res = await apiFetch('/api/logistics/shipping?status=all', { credentials: 'include' })
    // 获取已确认但尚未全部发货的订单
    const ordersRes = await apiFetch('/api/distribution/orders?status=CONFIRMED', { credentials: 'include' })
    const data = await ordersRes.json()
    if (ordersRes.ok) {
      // 过滤掉已存在发货单的订单
      const shippedRes = await apiFetch('/api/logistics/shipping', { credentials: 'include' })
      const shippedData = await shippedRes.json()
      const shippedOrderIds = new Set((shippedData.data || shippedData.orders || []).map((o: ShippingOrder) => o.salesOrderId))
      setConfirmedOrders((data.data?.orders || data.orders || []).filter((o: SalesOrder) => !shippedOrderIds.has(o.id)))
    }
  }, [])

  const fetchProviders = useCallback(async () => {
    const res = await apiFetch('/api/logistics/providers', { credentials: 'include' })
    const data = await res.json()
    if (res.ok) setProviders(data.data || data.providers || [])
  }, [])

  useEffect(() => { fetchShippingOrders(); fetchConfirmedOrders(); fetchProviders() }, [fetchShippingOrders, fetchConfirmedOrders, fetchProviders])
  useEffect(() => { fetchShippingOrders().catch(() => {}) }, [fetchShippingOrders])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (o: ShippingOrder) => {
    setEditingId(o.id)
    setForm({
      salesOrderId: o.salesOrderId,
      logisticsProvider: o.logisticsProvider || '',
      trackingNo: o.trackingNo || '',
      shippingDate: o.shippingDate ? o.shippingDate.slice(0, 10) : '',
      estimatedDays: String(o.estimatedDays || ''),
      totalPackage: String(o.totalPackage || ''),
      weight: String(o.weight || ''),
      volume: String(o.volume || ''),
      shippingCost: String(o.shippingCost || ''),
      remark: o.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.salesOrderId) return
    const url = editingId ? `/api/logistics/shipping/${editingId}` : '/api/logistics/shipping'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
      credentials: 'include',
    })
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      setForm(defaultForm)
      fetchShippingOrders()
      fetchConfirmedOrders()
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
    const res = await apiFetch(`/api/logistics/shipping/${confirmDeleteId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchShippingOrders()
  }

  const handleStatusChange = async (id: string, targetStatus: string) => {
    const res = await apiFetch(`/api/logistics/shipping/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
      credentials: 'include',
    })
    if (res.ok) {
      fetchShippingOrders()
      fetchConfirmedOrders()
    } else {
      const data = await res.json()
      showToast('error', data.error || '操作失败')
    }
  }

  // 物流商管理
  const openProviderCreate = () => {
    setProviderForm({ id: '', name: '', contact: '', phone: '' })
    setShowProviderForm(true)
  }

  const openProviderEdit = (p: LogisticsProvider) => {
    setProviderForm({ id: p.id, name: p.name, contact: p.contact || '', phone: p.phone || '' })
    setShowProviderForm(true)
  }

  const handleProviderSave = async () => {
    if (!providerForm.name) return
    const url = '/api/logistics/providers'
    const method = providerForm.id ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerForm),
      credentials: 'include',
    })
    if (res.ok) {
      setShowProviderForm(false)
      setProviderForm({ id: '', name: '', contact: '', phone: '' })
      fetchProviders()
    } else {
      const data = await res.json()
      showToast('error', data.error || '保存失败')
    }
  }

  const handleProviderDelete = async (id: string) => {
    if (!confirm('确定要删除此物流商吗？')) return
    const res = await apiFetch(`/api/logistics/providers?id=${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    fetchProviders()
  }

  const statusBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SHIPPING_STATUS_COLORS[s] || ''}`}>{SHIPPING_STATUS_LABELS[s] || s}</span>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/distribution')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">物流发运管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openProviderCreate} className="px-3 py-2 border rounded-lg text-sm hover:bg-[var(--color-bg)]">
              管理物流商
            </button>
            <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
              + 新建发货单
            </button>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 筛选 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-3 mb-4 flex items-center gap-3 text-sm">
          <span className="text-[var(--color-text-secondary)]">筛选：</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border rounded text-sm">
            <option value="">全部状态</option>
            {Object.entries(SHIPPING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* 新建/编辑发货单弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑发货单' : '新建发货单'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {!editingId && (
                  <div className="col-span-2">
                    <label className="block text-[var(--color-text-secondary)] mb-1">选择销售订单 *</label>
                    <select value={form.salesOrderId} onChange={e => setForm({ ...form, salesOrderId: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                      <option value="">选择已确认订单</option>
                      {confirmedOrders.map(o => (
                        <option key={o.id} value={o.id}>{o.orderNo} - {o.productName} × {o.quantity}</option>
                      ))}
                    </select>
                    {confirmedOrders.length === 0 && (
                      <p className="text-xs text-amber-500 mt-1">暂无待发货的已确认订单</p>
                    )}
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">物流商</label>
                  <div className="flex gap-2">
                    <select value={form.logisticsProvider} onChange={e => {
                      setForm({ ...form, logisticsProvider: e.target.value })
                      // 如果选择"管理物流商"，打开管理弹窗
                      if (e.target.value === '__MANAGE__') {
                        openProviderCreate()
                        setForm(f => ({ ...f, logisticsProvider: '' }))
                      }
                    }} className="flex-1 px-3 py-1.5 border rounded text-sm">
                      <option value="">选择物流商</option>
                      {providers.filter(p => p.isActive).map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                      <option disabled>──────────</option>
                      <option value="__MANAGE__">+ 管理物流商</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">物流单号</label>
                  <input type="text" value={form.trackingNo} onChange={e => setForm({ ...form, trackingNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="快递单号" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">发货日期</label>
                  <input type="date" value={form.shippingDate} onChange={e => setForm({ ...form, shippingDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">预计天数</label>
                  <input type="number" min="1" value={form.estimatedDays} onChange={e => setForm({ ...form, estimatedDays: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">总件数</label>
                  <input type="number" min="1" value={form.totalPackage} onChange={e => setForm({ ...form, totalPackage: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">重量 (kg)</label>
                  <input type="number" step="0.01" min="0" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">体积 (m³)</label>
                  <input type="number" step="0.001" min="0" value={form.volume} onChange={e => setForm({ ...form, volume: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">运费 (元)</label>
                  <input type="number" step="0.01" min="0" value={form.shippingCost} onChange={e => setForm({ ...form, shippingCost: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={3} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!editingId && !form.salesOrderId}>{editingId ? '保存修改' : '保存'}</button>
              </div>
            </div>
          </div>
        )}

        {/* 物流商管理弹窗 */}
        {showProviderForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowProviderForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{providerForm.id ? '编辑物流商' : '新增物流商'}</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">名称 *</label>
                  <input type="text" value={providerForm.name} onChange={e => setProviderForm({ ...providerForm, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：顺丰速运" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">联系人</label>
                  <input type="text" value={providerForm.contact} onChange={e => setProviderForm({ ...providerForm, contact: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">电话</label>
                  <input type="text" value={providerForm.phone} onChange={e => setProviderForm({ ...providerForm, phone: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowProviderForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleProviderSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!providerForm.name}>{providerForm.id ? '保存' : '新增'}</button>
              </div>

              {/* 已有物流商列表 */}
              {providers.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-medium mb-2">已有物流商</h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {providers.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--color-bg)] text-xs">
                        <div>
                          <span className={p.isActive ? '' : 'text-zinc-400 line-through'}>{p.name}</span>
                          {p.contact && <span className="text-[var(--color-text-secondary)] ml-2">{p.contact}</span>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openProviderEdit(p)} className="text-blue-500 hover:underline">编辑</button>
                          <button onClick={() => handleProviderDelete(p.id)} className="text-red-500 hover:underline">删除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 发货单列表 */}
        {loading ? (
          <div className="space-y-3 p-4">{[1, 2, 3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-16" /><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : shippingOrders.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="empty-state-title">暂无发货单</div>
            <div className="empty-state-desc">确认销售订单后，点击右上角"新建发货单"开始打单发货</div>
          </div>
        ) : (
          <div className="space-y-3">
            {shippingOrders.map((o) => (
              <div key={o.id} className="bg-[var(--color-card)] rounded-xl border p-4 hover:border-emerald-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{o.shippingNo}</span>
                      {statusBadge(o.status)}
                      {o.trackingNo && (
                        <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                          物流单号：{o.trackingNo}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">{o.salesOrder.productName}</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {' '}× {o.salesOrder.quantity}
                        {' · '}订单 {o.salesOrder.orderNo}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1 space-y-0.5">
                      <div>
                        {o.logisticsProvider && `${o.logisticsProvider} · `}
                        {o.totalPackage && `${o.totalPackage}件`}
                        {o.weight && ` · ${o.weight}kg`}
                        {o.volume && ` · ${o.volume}m³`}
                        {o.shippingCost != null && ` · ¥${o.shippingCost.toFixed(2)}`}
                      </div>
                      <div>
                        创建于 {new Date(o.createdAt).toLocaleDateString('zh-CN')}
                        {o.shippingDate && ` · 发货 ${new Date(o.shippingDate).toLocaleDateString('zh-CN')}`}
                        {o.estimatedDays != null && ` · 预计 ${o.estimatedDays}天`}
                        {o.deliveredDate && ` · 签收 ${new Date(o.deliveredDate).toLocaleDateString('zh-CN')}`}
                      </div>
                      {o.remark && <div className="text-[var(--color-text-secondary)]">备注：{o.remark}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-4 flex-wrap">
                    {STATUS_ACTIONS[o.status]?.map(action => (
                      <button
                        key={action.target}
                        onClick={() => handleStatusChange(o.id, action.target)}
                        className={`px-2.5 py-1 rounded text-xs text-white ${action.color} hover:opacity-90`}
                      >
                        {action.label}
                      </button>
                    ))}
                    <button
                      onClick={() => openEdit(o)}
                      className="px-2.5 py-1 rounded text-xs border text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(o.id)}
                      className="px-2.5 py-1 rounded text-xs border text-red-500 hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此发货单吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
