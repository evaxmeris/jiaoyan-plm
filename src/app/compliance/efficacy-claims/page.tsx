'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Pagination from '@/components/Pagination'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const PAGE_SIZE = 20

const CATEGORIES: Record<string, string> = {
  STANDARD: '国标功效',
  NEW: '新功效',
}

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  REVIEWING: '审核中',
  APPROVED: '已批准',
  REJECTED: '已驳回',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  REVIEWING: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}

const defaultForm = { claimName: '', category: 'STANDARD', productDesignId: '', evidence: '', remark: '' }

export default function EfficacyClaimsPage() {
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
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
    const [iRes, pRes] = await Promise.all([
      apiFetch('/api/compliance/efficacy-claims'),
      apiFetch('/api/rnd/products'),
    ])
    const iData = await iRes.json()
    if (!iRes.ok) throw new Error(iData.error || '加载功效宣称失败')
    // crud-factory returns data under "efficacyClaims" key
    setItems(iData.efficacyClaims || iData.data || [])
    const pData = await pRes.json()
    if (!pRes.ok) throw new Error(pData.error || '加载产品失败')
    setProducts(pData.products || pData.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const filteredItems = items.filter((i: any) =>
    !search ||
    i.claimName?.toLowerCase().includes(search.toLowerCase()) ||
    i.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    (CATEGORIES[i.category] || '').includes(search)
  )
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE)
  const paginatedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      claimName: item.claimName || '',
      category: item.category || 'STANDARD',
      productDesignId: item.productDesignId || '',
      evidence: item.evidence || '',
      remark: item.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const url = editingId ? `/api/compliance/efficacy-claims/${editingId}` : '/api/compliance/efficacy-claims'
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
    const res = await apiFetch(`/api/compliance/efficacy-claims/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  const updateStatus = async (id: string, status: string) => {
    const res = await apiFetch(`/api/compliance/efficacy-claims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '状态更新失败')
      return
    }
    fetchData()
  }

  const badge = (s: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s] || ''}`}>
      {STATUS_MAP[s] || s}
    </span>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/compliance')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">功效宣称管理</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新增宣称</button>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 搜索框 */}
        <div className="mb-4">
          <input type="text" placeholder="搜索宣称名称 / 产品名称..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑功效宣称' : '新增功效宣称'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">宣称名称 *</label>
                  <input type="text" value={form.claimName} onChange={e => setForm({...form, claimName: e.target.value})}
                    placeholder="如：美白、保湿、抗皱、舒缓" className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">宣称类别</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">关联产品</label>
                  <select value={form.productDesignId} onChange={e => setForm({...form, productDesignId: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">不关联</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">支持证据（检测报告编号/文献引用）</label>
                  <input type="text" value={form.evidence} onChange={e => setForm({...form, evidence: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.claimName}>
                  {editingId ? '保存修改' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div className="empty-state-title">暂无功效宣称记录</div>
            <div className="empty-state-desc">点击右上角"新增宣称"开始</div>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">宣称名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">类别</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">关联产品</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">状态</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">证据</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((i: any) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={i.claimName}>{i.claimName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${i.category === 'NEW' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {CATEGORIES[i.category] || i.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={i.product?.name || '-'}>{i.product?.name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{badge(i.status)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[200px] truncate" title={i.evidence || '-'}>{i.evidence || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {i.status === 'DRAFT' && (
                          <button onClick={() => updateStatus(i.id, 'REVIEWING')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">提交审核</button>
                        )}
                        {i.status === 'REVIEWING' && (
                          <>
                            <button onClick={() => updateStatus(i.id, 'APPROVED')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">批准</button>
                            <button onClick={() => updateStatus(i.id, 'REJECTED')} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">驳回</button>
                          </>
                        )}
                        <button onClick={() => openEdit(i)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button>
                        <button onClick={() => handleDelete(i.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>
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
          message="确定要删除此功效宣称记录吗？此操作不可撤销。"
          confirmLabel="删除"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
