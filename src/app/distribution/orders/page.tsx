'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface Channel {
  id: string
  name: string
  type: string
  status: string
}

interface SalesOrder {
  id: string
  orderNo: string
  channelId: string
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  orderDate: string
  status: string
  trackingNo: string | null
  remark: string | null
  createdAt: string
  channel: Channel
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  SHIPPING: '发货中',
  DELIVERED: '已完成',
  CANCELLED: '已取消',
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SHIPPING: 'bg-purple-100 text-purple-600',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  PLATFORM: '电商平台',
  DISTRIBUTOR: '经销商',
  RETAILER: '零售商',
  OFFLINE: '线下门店',
  OTHER: '其他',
}

// 状态变更按钮配置
const STATUS_ACTIONS: Record<string, { label: string; target: string; color: string }[]> = {
  PENDING: [
    { label: '确认', target: 'CONFIRMED', color: 'bg-blue-500' },
    { label: '取消', target: 'CANCELLED', color: 'bg-gray-400' },
  ],
  CONFIRMED: [
    { label: '发货', target: 'SHIPPING', color: 'bg-purple-500' },
    { label: '取消', target: 'CANCELLED', color: 'bg-gray-400' },
  ],
  SHIPPING: [
    { label: '完成', target: 'DELIVERED', color: 'bg-green-500' },
    { label: '取消', target: 'CANCELLED', color: 'bg-gray-400' },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

const defaultForm = {
  channelId: '', productName: '', quantity: '1', unitPrice: '0', orderDate: new Date().toISOString().slice(0, 10), remark: '',
}

export default function DistributionOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterChannel, setFilterChannel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const router = useRouter()
  const { showToast } = useToast()

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterChannel) params.set('channelId', filterChannel)
    if (filterStatus) params.set('status', filterStatus)
    const res = await apiFetch(`/api/distribution/orders?${params}`)
    const data = await res.json()
    if (res.ok) setOrders(data.data || data.orders || [])
    setLoading(false)
  }, [filterChannel, filterStatus])

  const fetchChannels = useCallback(async () => {
    const res = await apiFetch('/api/distribution/channels')
    const data = await res.json()
    if (res.ok) {
      setChannels(data.data?.distributionChannels || data.distributionChannels || data.data || [])
    }
  }, [])

  useEffect(() => { fetchChannels(); fetchOrders() }, [fetchOrders, fetchChannels])

  // 重新获取订单（当筛选变化时）
  useEffect(() => { fetchOrders().catch(() => {}) }, [fetchOrders])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (o: SalesOrder) => {
    setEditingId(o.id)
    setForm({
      channelId: o.channelId,
      productName: o.productName,
      quantity: String(o.quantity),
      unitPrice: String(o.unitPrice),
      orderDate: o.orderDate ? o.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      remark: o.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.channelId || !form.productName) return
    const url = editingId ? `/api/distribution/orders/${editingId}` : '/api/distribution/orders'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      setForm(defaultForm)
      fetchOrders()
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
    const res = await apiFetch(`/api/distribution/orders/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchOrders()
  }

  const handleStatusChange = async (id: string, targetStatus: string) => {
    const res = await apiFetch(`/api/distribution/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    })
    if (res.ok) {
      fetchOrders()
    } else {
      const data = await res.json()
      showToast('error', data.error || '操作失败')
    }
  }

  const statusBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ORDER_STATUS_COLORS[s] || ''}`}>{ORDER_STATUS_LABELS[s] || s}</span>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/distribution')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">销售订单</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建订单</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 筛选 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-3 mb-4 flex items-center gap-3 text-sm">
          <span className="text-[var(--color-text-secondary)]">筛选：</span>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="px-3 py-1.5 border rounded text-sm">
            <option value="">全部渠道</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border rounded text-sm">
            <option value="">全部状态</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* 新建/编辑订单弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑订单' : '新建订单'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">销售渠道 *</label>
                  <select value={form.channelId} onChange={e => setForm({ ...form, channelId: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">选择渠道</option>
                    {channels.filter(c => c.status !== 'INACTIVE').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">产品名称 *</label>
                  <input type="text" value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">数量</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">单价 (元)</label>
                  <input type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                  {form.unitPrice && form.quantity && (
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      合计：¥{(parseFloat(form.unitPrice) * parseInt(form.quantity || '0')).toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">订单日期</label>
                  <input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={3} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.channelId || !form.productName}>{editingId ? '保存修改' : '保存'}</button>
              </div>
            </div>
          </div>
        )}

        {/* 订单列表 */}
        {loading ? <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-20" /><div className="skeleton h-4 w-16" /><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /></div>)}</div> : orders.length === 0 ? (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg><div className="empty-state-title">暂无销售订单</div><div className="empty-state-desc">点击右上角"新建订单"开始</div></div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="bg-[var(--color-card)] rounded-xl border p-4 hover:border-emerald-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{o.orderNo}</span>
                      {statusBadge(o.status)}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">{o.productName}</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {' '}× {o.quantity}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1 space-y-0.5">
                      <div>
                        {o.channel.name} · {CHANNEL_TYPE_LABELS[o.channel.type] || o.channel.type}
                        {' · '}¥{o.unitPrice.toFixed(2)}/件 · 合计 ¥{o.totalAmount.toFixed(2)}
                      </div>
                      <div>
                        {new Date(o.orderDate).toLocaleDateString('zh-CN')}
                        {o.trackingNo && ` · 物流单号：${o.trackingNo}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-4">
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

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此销售订单吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
