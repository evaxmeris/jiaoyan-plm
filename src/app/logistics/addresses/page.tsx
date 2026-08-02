'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

interface ShippingAddress {
  id: string
  label: string
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
  remark: string | null
  createdAt: string
}

const defaultForm = {
  label: '',
  receiver: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
  remark: '',
}

const CHINA_PROVINCES = [
  '北京市', '天津市', '上海市', '重庆市',
  '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省',
  '广东省', '海南省', '四川省', '贵州省', '云南省', '陕西省',
  '甘肃省', '青海省', '台湾省',
  '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区',
]

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  const fetchAddresses = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/logistics/addresses', { credentials: 'include' })
    const data = await res.json()
    if (res.ok) setAddresses(data.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAddresses() }, [fetchAddresses])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (a: ShippingAddress) => {
    setEditingId(a.id)
    setForm({
      label: a.label,
      receiver: a.receiver,
      phone: a.phone,
      province: a.province,
      city: a.city,
      district: a.district,
      detail: a.detail,
      isDefault: a.isDefault,
      remark: a.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.label || !form.receiver || !form.phone || !form.province || !form.city || !form.district || !form.detail) {
      showToast('error', '请填写完整的地址信息')
      return
    }

    const url = editingId ? '/api/logistics/addresses' : '/api/logistics/addresses'
    const method = editingId ? 'PUT' : 'POST'
    const body = editingId ? { ...form, id: editingId } : form

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      setForm(defaultForm)
      fetchAddresses()
      showToast('success', editingId ? '地址已更新' : '地址已创建')
    } else {
      const data = await res.json()
      showToast('error', data.error || '保存失败')
    }
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await fetch(`/api/logistics/addresses?id=${confirmDeleteId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    } else {
      showToast('success', '地址已删除')
    }
    setConfirmDeleteId(null)
    fetchAddresses()
  }

  const renderForm = () => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
      <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑收货地址' : '新增收货地址'}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">地址标签 *</label>
            <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：仓库地址、办公地址" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">收货人 *</label>
            <input type="text" value={form.receiver} onChange={e => setForm({ ...form, receiver: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="姓名" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">联系电话 *</label>
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="手机号" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">省份/直辖市 *</label>
            <select value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
              <option value="">选择省份</option>
              {CHINA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">城市 *</label>
            <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：广州市" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">区/县 *</label>
            <input type="text" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：天河区" />
          </div>
          <div className="col-span-2">
            <label className="block text-[var(--color-text-secondary)] mb-1">详细地址 *</label>
            <textarea value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} placeholder="街道、门牌号等" />
          </div>
          <div className="col-span-2">
            <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
            <input type="text" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="备注信息" />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="rounded" />
              <span className="text-sm">设为默认地址</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">{editingId ? '保存修改' : '保存'}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/logistics/shipping')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回物流</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">收货地址管理</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
            + 新增地址
          </button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {loading ? (
          <div className="space-y-3 p-4">{[1, 2].map(i => <div key={i} className="skeleton h-20 w-full" />)}</div>
        ) : addresses.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="empty-state-title">暂无收货地址</div>
            <div className="empty-state-desc">点击右上角"新增地址"添加常用收货地址</div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map(a => (
              <div key={a.id} className={`bg-[var(--color-card)] rounded-xl border p-4 hover:shadow-sm transition-all ${a.isDefault ? 'border-emerald-400 ring-1 ring-emerald-200' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{a.label}</span>
                      {a.isDefault && <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-medium">默认</span>}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">{a.receiver}</span>
                      <span className="text-[var(--color-text-secondary)] ml-2">{a.phone}</span>
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {a.province}{a.city}{a.district}{a.detail}
                    </div>
                    {a.remark && <div className="text-xs text-[var(--color-text-secondary)] mt-1">备注：{a.remark}</div>}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button onClick={() => openEdit(a)} className="px-2.5 py-1 rounded text-xs border text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                    <button onClick={() => setConfirmDeleteId(a.id)} className="px-2.5 py-1 rounded text-xs border text-red-500 hover:bg-red-50">删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && renderForm()}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此收货地址吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
