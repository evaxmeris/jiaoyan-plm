'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Pagination from '@/components/Pagination'
import { useCrud } from '@/lib/useCrud'
import PageHeader from '@/components/PageHeader'
import { useToast } from '@/components/Toast'

const PAGE_SIZE = 20

const TYPES: Record<string, string> = { RAW_MATERIAL: '原料供应商', PACKAGING: '包材供应商', OEM: '代工厂', TESTING: '检测机构', CERTIFICATION_BODY: '认证机构', OTHER: '其他' }

export default function SuppliersPage() {
  const { items: suppliers, loading, openCreate, openEdit, handleSave, handleDelete } = useCrud<any>('/api/supply/suppliers')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'RAW_MATERIAL', contact: '', phone: '', email: '', address: '', rating: '', remark: '' })
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => { setPage(1) }, [search])

  const filteredSuppliers = suppliers.filter((s: any) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filteredSuppliers.length / PAGE_SIZE)
  const paginatedSuppliers = filteredSuppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetForm = () => {
    setForm({ name: '', type: 'RAW_MATERIAL', contact: '', phone: '', email: '', address: '', rating: '', remark: '' })
  }

  const handleOpenCreate = () => {
    resetForm()
    openCreate()
    setShowForm(true)
  }

  const handleOpenEdit = (supplier: any) => {
    setForm({
      name: supplier.name || '',
      type: supplier.type || 'RAW_MATERIAL',
      contact: supplier.contact || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      rating: supplier.rating != null ? String(supplier.rating) : '',
      remark: supplier.remark || '',
    })
    openEdit(supplier)
    setShowForm(true)
  }

  const onSave = async () => {
    try {
      // rating 空字符串转 null（Prisma Float 字段不接受 ''，否则编辑保存必 400）
      const payload = { ...form, rating: form.rating === '' ? null : Number(form.rating) }
      await handleSave(payload)
      setShowForm(false)
      resetForm()
      showToast('success', '保存成功')
    } catch (e: any) {
      showToast('error', e.message || '保存失败')
    }
  }

  const handleDeleteClick = async (id: string, name: string) => {
    if (!confirm(`确认删除供应商「${name}」？删除后数据将移至回收站。`)) return
    try {
      await handleDelete(id)
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] mb-4 inline-block">&larr; 返回</button>
          <PageHeader
            title="供应商管理"
            action={{ label: '+ 新增供应商', onClick: handleOpenCreate }}
          />
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索供应商名称 / 联系人..."
            className="w-full md:max-w-sm px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text)]"
          />
        </div>
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{form.name ? '编辑供应商' : '新增供应商'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">供应商名称 *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">类型</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">评分</label><input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">联系人</label><input type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">电话</label><input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">地址</label><input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); resetForm() }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={onSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.name}>保存</button>
              </div>
            </div>
          </div>
        )}
        {loading ? <div className="space-y-3 p-4">{[1, 2, 3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div> : suppliers.length === 0 ? <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg><div className="empty-state-title">还没有供应商</div><div className="empty-state-desc">还没有供应商，点击新建</div><button onClick={handleOpenCreate} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新增供应商</button></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginatedSuppliers.map((s: any) => (
              <div key={s.id} onClick={() => router.push(`/supply/suppliers/${s.id}`)} className="bg-[var(--color-card)] rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{s.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-card)] text-[var(--color-text-secondary)]">{TYPES[s.type] || s.type}</span>
                    {s.rating != null && s.rating !== '' && (() => { const r = Math.min(5, Math.max(0, Math.round(Number(s.rating)) || 0)); return r > 0 ? <span className="text-xs text-amber-500 ml-2">{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span> : null })()}
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => router.push(`/supply/suppliers/${s.id}`)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded" title="查看">查看</button>
                    <button onClick={() => handleOpenEdit(s)} className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded" title="编辑">编辑</button>
                    <button onClick={() => handleDeleteClick(s.id, s.name)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded" title="删除">删除</button>
                  </div>
                </div>
                {(s.contact || s.phone) && <div className="text-xs text-[var(--color-text-secondary)] mt-2">{s.contact && `${s.contact} `}{s.phone}</div>}
                {s.address && <div className="text-xs text-[var(--color-text-secondary)] mt-1">{s.address}</div>}
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
      </main>
    </div>
  )
}
