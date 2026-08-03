'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const CATEGORIES = [
  { value: 'LAB_SUPPLIES', label: '实验用品', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'EQUIPMENT', label: '设备', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'OFFICE_SUPPLIES', label: '办公用品', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  { value: 'GIFTS', label: '礼品', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  { value: 'OTHER', label: '其他', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
]

function getCategoryInfo(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1]
}

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showStockIn, setShowStockIn] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [stockInSupplyId, setStockInSupplyId] = useState<string | null>(null)
  const [suppliesForSelect, setSuppliesForSelect] = useState<any[]>([])
  const router = useRouter()
  const { showToast } = useToast()

  const defaultForm = {
    name: '', category: 'OTHER', unit: '个', specification: '',
    minStock: '0', supplier: '', remark: '',
  }
  const [form, setForm] = useState({ ...defaultForm })

  const stockInDefault = { supplyId: '', batchNo: '', quantity: '', receiptDate: '', expireDate: '', supplier: '', remark: '' }
  const [stockInForm, setStockInForm] = useState({ ...stockInDefault })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/api/supply/supplies?q=${search}`)
    const data = await res.json()
    if (!res.ok) { showToast('error', data.error || '加载失败'); setLoading(false); return }
    setSupplies(data.data || data.supplies || [])
    setLoading(false)
  }, [search, showToast])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setShowForm(true)
  }

  const openEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      category: item.category || 'OTHER',
      unit: item.unit || '个',
      specification: item.specification || '',
      minStock: item.minStock?.toString() || '0',
      supplier: item.supplier || '',
      remark: item.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const url = editingId ? `/api/supply/supplies/${editingId}` : '/api/supply/supplies'
    const method = editingId ? 'PUT' : 'POST'
    const body = editingId ? { ...form } : form
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      showToast('success', editingId ? '更新成功' : '创建成功')
      fetchData()
    } else {
      const err = await res.json()
      showToast('error', err.error || (editingId ? '更新失败' : '创建失败'))
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/supply/supplies/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    } else {
      showToast('success', '已删除')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  // 入库弹窗
  const openStockIn = async (supplyId?: string) => {
    // 加载全部物资供选择
    const res = await apiFetch('/api/supply/supplies?q=')
    const data = await res.json()
    setSuppliesForSelect(data.data || data.supplies || [])
    setStockInForm({
      ...stockInDefault,
      supplyId: supplyId || '',
      receiptDate: new Date().toISOString().slice(0, 10),
    })
    setShowStockIn(true)
  }

  const handleStockIn = async () => {
    if (!stockInForm.supplyId || !stockInForm.batchNo || !stockInForm.quantity) {
      showToast('error', '请选择物资并填写批次号和数量')
      return
    }
    const res = await apiFetch('/api/supply/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stockInForm),
    })
    if (res.ok) {
      setShowStockIn(false)
      showToast('success', '入库成功')
      fetchData()
    } else {
      const err = await res.json()
      showToast('error', err.error || '入库失败')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">物资管理</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openStockIn()} className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 text-sm">+ 入库</button>
            <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建物资</button>
          </div>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="mb-4">
          <input type="text" placeholder="搜索物资名称 / 规格 / 供应商..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
        </div>

        {/* 新建/编辑弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑物资' : '新建物资'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">名称 *</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">分类 *</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">单位</label>
                  <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">规格型号</label>
                  <input type="text" value={form.specification} onChange={e => setForm({...form, specification: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">最低库存</label>
                  <input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">供应商</label>
                  <input type="text" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.name}>
                  {editingId ? '保存修改' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 入库弹窗 */}
        {showStockIn && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowStockIn(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">物资入库</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">物资 *</label>
                  <select value={stockInForm.supplyId} onChange={e => setStockInForm({...stockInForm, supplyId: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">选择物资</option>
                    {suppliesForSelect.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.currentStock}{s.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">批次号 *</label>
                  <input type="text" value={stockInForm.batchNo} onChange={e => setStockInForm({...stockInForm, batchNo: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">数量 *</label>
                  <input type="number" value={stockInForm.quantity} onChange={e => setStockInForm({...stockInForm, quantity: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">入库日期</label>
                  <input type="date" value={stockInForm.receiptDate} onChange={e => setStockInForm({...stockInForm, receiptDate: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">有效期至</label>
                  <input type="date" value={stockInForm.expireDate} onChange={e => setStockInForm({...stockInForm, expireDate: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">供应商</label>
                  <input type="text" value={stockInForm.supplier} onChange={e => setStockInForm({...stockInForm, supplier: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={stockInForm.remark} onChange={e => setStockInForm({...stockInForm, remark: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowStockIn(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleStockIn} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                  disabled={!stockInForm.supplyId || !stockInForm.batchNo || !stockInForm.quantity}>
                  确认入库
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">
            {[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}
          </div>
        ) : supplies.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div className="empty-state-title">暂无物资</div>
            <div className="empty-state-desc">点击右上角"新建物资"添加</div>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">分类</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">规格</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">库存</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">最低库存</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">供应商</th>
                  <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((s: any) => {
                  const catInfo = getCategoryInfo(s.category)
                  const isLowStock = s.minStock > 0 && s.currentStock < s.minStock
                  return (
                    <tr key={s.id} className={`border-b last:border-0 hover:bg-[var(--color-bg)] ${isLowStock ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{s.specification || '-'}</td>
                      <td className={`px-4 py-3 text-right font-mono ${isLowStock ? 'text-red-600 font-bold' : ''}`}>
                        {s.currentStock}{s.unit}
                        {isLowStock && <span className="ml-1 text-xs text-red-500">⚠️</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                        {s.minStock > 0 ? `${s.minStock}${s.unit}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{s.supplier || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openStockIn(s.id)} className="px-2 py-1 text-xs border rounded text-emerald-600 hover:bg-emerald-50">入库</button>
                          <button onClick={() => openEdit(s)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                          <button onClick={() => handleDelete(s.id)} className="px-2 py-1 text-xs border rounded text-red-500 hover:bg-red-50">删除</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此物资吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
