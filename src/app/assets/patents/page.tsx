'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useCrud } from '@/lib/useCrud'
import PageHeader from '@/components/PageHeader'

const TYPES: Record<string, string> = { INVENTION: '发明专利', UTILITY: '实用新型', DESIGN: '外观设计' }
const STATUS: Record<string, string> = { DRAFT: '草稿', FILING: '已提交', ACCEPTED: '已受理', SUBSTANTIVE: '实质审查', AUTHORIZED: '已授权', MAINTENANCE: '年费维护中', EXPIRED: '已失效', REJECTED: '被驳回' }
const COLORS: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-600', FILING: 'bg-blue-100 text-blue-700', ACCEPTED: 'bg-cyan-100 text-cyan-700', SUBSTANTIVE: 'bg-yellow-100 text-yellow-700', AUTHORIZED: 'bg-green-100 text-green-700', MAINTENANCE: 'bg-emerald-100 text-emerald-700', EXPIRED: 'bg-gray-100 text-gray-500', REJECTED: 'bg-red-100 text-red-600' }

const defaultForm = { name: '', type: 'INVENTION', inventor: '', applicationNo: '', techField: '', applicant: '中山交研生物科技有限公司', applyDate: '', expireDate: '', remark: '' }

export default function PatentsPage() {
  const { items, loading, openCreate, openEdit, handleSave, handleDelete, editingItem } = useCrud<any>('/api/assets/patents')
  const [form, setForm] = useState(defaultForm)
  const [localShowForm, setLocalShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // 本地搜索过滤（名称/发明人/申请号）
  const filteredItems = items.filter((i: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (i.name || '').toLowerCase().includes(q) ||
      (i.inventor || '').toLowerCase().includes(q) ||
      (i.applicationNo || '').toLowerCase().includes(q)
  })
  const router = useRouter()
  const { showToast } = useToast()

  const handleOpenCreate = () => {
    setForm(defaultForm)
    openCreate()
    setLocalShowForm(true)
  }

  const handleOpenEdit = (i: any) => {
    setForm({
      name: i.name || '',
      type: i.type || 'INVENTION',
      inventor: i.inventor || '',
      applicationNo: i.applicationNo || '',
      techField: i.techField || '',
      applicant: i.applicant || '中山交研生物科技有限公司',
      applyDate: i.applyDate ? i.applyDate.slice(0, 10) : '',
      expireDate: i.expireDate ? i.expireDate.slice(0, 10) : '',
      remark: i.remark || '',
    })
    openEdit(i)
    setLocalShowForm(true)
  }

  const onSave = async () => {
    try {
      await handleSave(form)
      setLocalShowForm(false)
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDeleteAction = async () => {
    if (!confirmDeleteId) return
    try {
      await handleDelete(confirmDeleteId)
    } catch (e: any) {
      showToast('error', e.message)
    }
    setConfirmDeleteId(null)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <button onClick={() => router.push('/assets')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] mb-4 inline-block">&larr; 返回</button>
          <PageHeader
            title="专利管理"
            action={{ label: '+ 新增专利', onClick: handleOpenCreate }}
          />
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索专利名称 / 发明人 / 申请号..."
            className="w-full md:max-w-sm px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text)]"
          />
        </div>
        {localShowForm && (<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setLocalShowForm(false)}><div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-semibold mb-4">{editingItem ? '编辑专利' : '新增专利'}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">专利名称 *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">类型</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">技术领域</label><input type="text" value={form.techField} onChange={e => setForm({ ...form, techField: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="S²R双酶技术" /></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">发明人 *</label><input type="text" value={form.inventor} onChange={e => setForm({ ...form, inventor: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">申请号</label><input type="text" value={form.applicationNo} onChange={e => setForm({ ...form, applicationNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">申请日</label><input type="date" value={form.applyDate} onChange={e => setForm({ ...form, applyDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">年费到期</label><input type="date" value={form.expireDate} onChange={e => setForm({ ...form, expireDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4 justify-end"><button onClick={() => setLocalShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button><button onClick={onSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.name || !form.inventor}>{editingItem ? '保存修改' : '保存'}</button></div>
        </div></div>)}
        {loading ? <div className="space-y-3 p-4">{[1, 2, 3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div> : items.length === 0 ? <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg><div className="empty-state-title">暂无专利</div><div className="empty-state-desc">点击右上角"新增专利"开始</div></div> : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="bg-[var(--color-bg)] border-b"><th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">专利名称</th><th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">类型</th><th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">发明人</th><th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">状态</th><th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">申请号</th><th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th></tr></thead>
            <tbody>{filteredItems.map((i: any) => (<tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]"><td className="px-4 py-3 font-medium">{i.name}</td><td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{TYPES[i.type] || i.type}</td><td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{i.inventor}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[i.status] || ''}`}>{STATUS[i.status] || i.status}</span></td><td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{i.applicationNo || '-'}</td><td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => router.push(`/assets/patents/${i.id}`)} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">查看</button><button onClick={() => handleOpenEdit(i)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button><button onClick={() => handleDeleteClick(i.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button></div></td></tr>))}</tbody>
            </table>
          </div>
        )}
      </main>

      {/* 删除确认 */}
      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此专利吗？此操作不可撤销。"
          confirmLabel="删除"
          onConfirm={confirmDeleteAction}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
