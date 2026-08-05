'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Pagination from '@/components/Pagination'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const PAGE_SIZE = 20

interface Registration {
  id: string
  registerNo: string | null
  registerType: string
  applyDate: string | null
  approveDate: string | null
  expiryDate: string | null
  status: string
  remark: string | null
  product: { id: string; name: string } | null
  testEntrustments: { id: string; type: string; result: string }[]
}

const defaultForm = { productId: '', registerNo: '', registerType: '国产普通', applyDate: '', remark: '' }

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [rRes, pRes] = await Promise.all([apiFetch('/api/compliance/registrations'), apiFetch('/api/rnd/products')])
    const rData = await rRes.json()
    if (!rRes.ok) throw new Error(rData.error || '加载备案失败')
    const pData = await pRes.json()
    if (!pRes.ok) throw new Error(pData.error || '加载产品失败')
    setRegistrations(rData.registrations || [])
    setProducts((pData.data || pData.productDesigns || pData.products || []).map((p: any) => ({ id: p.id, name: p.name })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const filteredRegistrations = registrations.filter(r =>
    !search || r.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    (r.registerNo && r.registerNo.toLowerCase().includes(search.toLowerCase()))
  )
  const totalPages = Math.ceil(filteredRegistrations.length / PAGE_SIZE)
  const paginatedRegistrations = filteredRegistrations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (r: Registration) => {
    setEditingId(r.id)
    setForm({
      productId: r.product?.id || '',
      registerNo: r.registerNo || '',
      registerType: r.registerType || '国产普通',
      applyDate: r.applyDate ? r.applyDate.slice(0, 10) : '',
      remark: r.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const url = editingId ? `/api/compliance/registrations/${editingId}` : '/api/compliance/registrations'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || (editingId ? '更新失败' : '创建失败'))
      return
    }
    setShowForm(false)
    setEditingId(null)
    fetchData()
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/compliance/registrations/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = { APPLYING: '首次申请', SUPPLEMENT: '补充资料', REGISTERED: '已备案', CHANGE: '变更中', CANCELLED: '注销' }
    return labels[s] || s
  }
  const statusColor = (s: string) => {
    const colors: Record<string, string> = { APPLYING: 'bg-blue-100 text-blue-700', SUPPLEMENT: 'bg-yellow-100 text-yellow-700', REGISTERED: 'bg-green-100 text-green-700', CHANGE: 'bg-purple-100 text-purple-700', CANCELLED: 'bg-gray-100 text-gray-500' }
    return colors[s] || ''
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">备案管理</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建备案</button>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 搜索框 */}
        <div className="mb-4">
          <input type="text" placeholder="搜索产品名称 / 备案编号..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑备案' : '新建备案'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">关联产品 *</label>
                  <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">选择产品</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">备案编号</label><input type="text" value={form.registerNo} onChange={e => setForm({...form, registerNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">备案类型</label><select value={form.registerType} onChange={e => setForm({...form, registerType: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"><option>国产普通</option><option>进口普通</option></select></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">申请日期</label><input type="date" value={form.applyDate} onChange={e => setForm({...form, applyDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.productId}>{editingId ? '保存修改' : '保存'}</button>
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="space-y-3 p-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <div className="empty-state-title">还没有备案记录</div>
            <div className="empty-state-desc">点击下方按钮新建第一条备案</div>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建备案</button>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead><tr className="bg-[var(--color-bg)] border-b">
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">产品</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">备案编号</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">类型</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">状态</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">申请日</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">检测</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
              </tr></thead>
              <tbody>
                {paginatedRegistrations.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={r.product?.name || '-'}>{r.product?.name || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{r.registerNo || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.registerType}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</span></td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs whitespace-nowrap">{r.applyDate ? new Date(r.applyDate).toLocaleDateString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{r.testEntrustments?.length || 0} 项</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(r)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button>
                        <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </main>

      {/* 删除确认 */}
      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此备案记录吗？此操作不可撤销。"
          confirmLabel="删除"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
