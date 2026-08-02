'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useCrud } from '@/lib/useCrud'
import PageHeader from '@/components/PageHeader'

const STATUS: Record<string, string> = {
  DRAFT: '草稿', FILING: '已提交申请', ACCEPTED: '已受理',
  PUBLISHED: '初审公告', OPPOSITION: '异议中', REGISTERED: '已注册',
  RENEWING: '续展中', EXPIRED: '已过期', REJECTED: '被驳回',
}
const COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  FILING: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  PUBLISHED: 'bg-yellow-100 text-yellow-700',
  OPPOSITION: 'bg-red-100 text-red-600',
  REGISTERED: 'bg-green-100 text-green-700',
  RENEWING: 'bg-purple-100 text-purple-700',
  EXPIRED: 'bg-gray-100 text-gray-400',
  REJECTED: 'bg-red-100 text-red-700',
}
const TYPES: Record<string, string> = { WORD: '文字商标', FIGURE: '图形商标', COMBINED: '组合商标' }

const defaultForm = {
  name: '', type: 'WORD', category: '3', applicationNo: '',
  owner: '中山交研生物科技有限公司', applyDate: '', expireDate: '',
  filingDate: '', agency: '', fee: '', remark: '',
}

export default function TrademarksPage() {
  const { items, loading, openCreate, openEdit, handleSave, handleDelete } = useCrud<any>('/api/assets/trademarks')
  const [form, setForm] = useState(defaultForm)
  const [localShowForm, setLocalShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { showToast } = useToast()

  // 本地搜索过滤（名称/申请号/权利人）
  const filteredItems = items.filter((i: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (i.name || '').toLowerCase().includes(q) ||
      (i.applicationNo || '').toLowerCase().includes(q) ||
      (i.owner || '').toLowerCase().includes(q)
  })

  const handleOpenCreate = () => {
    setForm(defaultForm)
    openCreate()
    setLocalShowForm(true)
  }

  const handleOpenEdit = (i: any) => {
    setForm({
      name: i.name || '',
      type: i.type || 'WORD',
      category: i.category || '3',
      applicationNo: i.applicationNo || '',
      owner: i.owner || '中山交研生物科技有限公司',
      applyDate: i.applyDate ? i.applyDate.slice(0, 10) : '',
      expireDate: i.expireDate ? i.expireDate.slice(0, 10) : '',
      filingDate: i.filingDate ? i.filingDate.slice(0, 10) : '',
      agency: i.agency || '',
      fee: i.fee?.toString() || '',
      remark: i.remark || '',
    })
    openEdit(i)
    setLocalShowForm(true)
  }

  const onSave = async () => {
    try {
      await handleSave({
        ...form,
        applyDate: form.applyDate || null,
        filingDate: form.filingDate || null,
        fee: form.fee ? parseFloat(form.fee) : null,
      })
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

  const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('zh-CN') : '-'

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <button onClick={() => router.push('/assets')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] mb-4 inline-block">&larr; 返回</button>
          <PageHeader
            title="商标管理"
            action={{ label: '+ 新增商标', onClick: handleOpenCreate }}
          />
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索商标名称 / 申请号 / 权利人..."
            className="w-full md:max-w-sm px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text)]"
          />
        </div>
        {localShowForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setLocalShowForm(false) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{form.name ? '编辑商标' : '新增商标'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">商标名称 *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">类型</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm"><option value="WORD">文字</option><option value="FIGURE">图形</option><option value="COMBINED">组合</option></select></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">类别</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm"><option value="3">3类(化妆品)</option><option value="5">5类(医药)</option><option value="35">35类(广告销售)</option></select></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">申请号</label><input type="text" value={form.applicationNo} onChange={e => setForm({ ...form, applicationNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">权利人</label><input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm bg-[var(--color-bg)]" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">申请日</label><input type="date" value={form.applyDate} onChange={e => setForm({ ...form, applyDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">受理日</label><input type="date" value={form.filingDate} onChange={e => setForm({ ...form, filingDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">到期日</label><input type="date" value={form.expireDate} onChange={e => setForm({ ...form, expireDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">代理机构</label><input type="text" value={form.agency} onChange={e => setForm({ ...form, agency: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">申请费用</label><input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setLocalShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={onSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.name}>{form.name ? '保存修改' : '保存'}</button>
              </div>
            </div>
          </div>
        )}
        {loading ? <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div> : items.length === 0 ? <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><div className="empty-state-title">还没有商标</div><div className="empty-state-desc">点击下方按钮添加第一个商标</div><button onClick={handleOpenCreate} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新增商标</button></div> : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">商标名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">类别</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">申请号</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">状态</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">申请日</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">有效期至</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">权利人</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i: any) => {
                  const expireWarning = i.expireDate && new Date(i.expireDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  return (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                      <td className="px-4 py-3 font-medium">{i.name}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">第{i.category}类</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">{i.applicationNo || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[i.status] || ''}`}>{STATUS[i.status] || i.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{formatDate(i.applyDate)}</td>
                      <td className={`px-4 py-3 text-xs ${expireWarning ? 'text-red-500 font-medium' : 'text-[var(--color-text-secondary)]'}`}>
                        {formatDate(i.expireDate)}
                        {expireWarning && <span className="ml-1 text-red-500">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{i.owner}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => router.push(`/assets/trademarks/${i.id}`)} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">查看</button>
                          <button onClick={() => handleOpenEdit(i)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button>
                          <button onClick={() => handleDeleteClick(i.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>
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

      {/* 删除确认 */}
      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此商标吗？此操作不可撤销。"
          confirmLabel="删除"
          onConfirm={confirmDeleteAction}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
