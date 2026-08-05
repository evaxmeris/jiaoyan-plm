'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface DistributionChannel {
  id: string
  name: string
  type: string
  contact: string | null
  phone: string | null
  commissionRate: number | null
  status: string
  remark: string | null
  createdAt: string
  _count: { orders: number }
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  PLATFORM: '电商平台',
  DISTRIBUTOR: '经销商',
  RETAILER: '零售商',
  OFFLINE: '线下门店',
  OTHER: '其他',
}

const CHANNEL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '启用',
  INACTIVE: '停用',
}

const defaultForm = {
  name: '', type: 'PLATFORM', contact: '', phone: '', commissionRate: '', status: 'ACTIVE', remark: '',
}

export default function DistributionPage() {
  const [channels, setChannels] = useState<DistributionChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [stats, setStats] = useState({ totalChannels: 0, activeChannels: 0, monthlyOrders: 0, monthlySales: 0 })
  const router = useRouter()
  const { showToast } = useToast()
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<{id:string;name:string} | null>(null)

  const fetchChannels = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch('/api/distribution/channels')
    const data = await res.json()
    if (res.ok) {
      setChannels(data.data || data.channels || [])
    }
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/distribution/orders')
      const data = await res.json()
      const orders = data.data || data.orders || []
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthOrders = orders.filter((o: any) => new Date(o.orderDate) >= monthStart)
      const monthlySales = monthOrders.reduce((sum: number, o: any) => sum + o.totalAmount, 0)
      setStats({
        totalChannels: channels.length,
        activeChannels: channels.filter(c => c.status === 'ACTIVE').length,
        monthlyOrders: monthOrders.length,
        monthlySales,
      })
    } catch { /* ignore */ }
  }, [channels])

  useEffect(() => { fetchChannels().catch(() => {}) }, [fetchChannels])
  useEffect(() => { fetchStats().catch(() => {}) }, [fetchStats])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (c: DistributionChannel) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      type: c.type,
      contact: c.contact || '',
      phone: c.phone || '',
      commissionRate: c.commissionRate?.toString() || '',
      status: c.status,
      remark: c.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name) return
    const url = editingId
      ? `/api/distribution/channels/${editingId}`
      : '/api/distribution/channels'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      fetchChannels()
    } else {
      const data = await res.json()
      showToast('error', data.error || '操作失败')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    setConfirmDeleteChannel({id, name})
    return
    const res = await apiFetch(`/api/distribution/channels/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchChannels()
    } else {
      const data = await res.json()
      showToast('error', data.error || '删除失败')
    }
  }

  const statusBadge = (s: string) => {
    const color = s === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{CHANNEL_STATUS_LABELS[s] || s}</span>
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--color-text)]">分销总览</h1>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建渠道</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">渠道总数</div>
            <div className="text-2xl font-bold">{stats.totalChannels}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">启用渠道</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.activeChannels}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">本月订单</div>
            <div className="text-2xl font-bold">{stats.monthlyOrders}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">本月销售额</div>
            <div className="text-2xl font-bold text-emerald-600">¥{stats.monthlySales.toLocaleString()}</div>
          </div>
        </div>

        {/* 渠道列表 */}
        <div className="bg-[var(--color-card)] rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium text-sm">渠道列表</h2>
            <button onClick={() => router.push('/distribution/orders')} className="text-xs text-emerald-600 hover:text-emerald-700">查看订单 →</button>
          </div>

          {loading ? (
            <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-16" /><div className="skeleton h-4 w-32" /></div>)}</div>
          ) : channels.length === 0 ? (
            <div className="empty-state py-8"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /></svg><div className="empty-state-title">暂无渠道</div><div className="empty-state-desc">点击右上角按钮新建</div></div>
          ) : (
            <div className="divide-y">
              {channels.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg)]">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.name}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {CHANNEL_TYPE_LABELS[c.type] || c.type}
                      {c.contact && ` · ${c.contact}`}
                      {c.commissionRate !== null && ` · 佣金 ${c.commissionRate}%`}
                      {` · ${c._count.orders} 笔订单`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="text-xs text-emerald-600 hover:text-emerald-700">编辑</button>
                    <button onClick={() => handleDelete(c.id, c.name)} className="text-xs text-red-500 hover:text-red-600">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 新建/编辑渠道弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑渠道' : '新建渠道'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">渠道名称 *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">渠道类型</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                  {Object.entries(CHANNEL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">状态</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                  <option value="ACTIVE">启用</option>
                  <option value="INACTIVE">停用</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">联系人</label>
                <input type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">联系电话</label>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">佣金比例 (%)</label>
                <input type="number" step="0.01" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={3} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
              <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.name}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
