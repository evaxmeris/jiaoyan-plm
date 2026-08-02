'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import Pagination from '@/components/Pagination'
import { useList, useCreate } from '@/lib/api-hooks'

const LEVEL_LABELS: Record<string, string> = {
  TOP_SECRET: '绝密',
  CONFIDENTIAL: '机密',
  INTERNAL: '内部',
}
const LEVEL_COLORS: Record<string, string> = {
  TOP_SECRET: 'bg-red-100 text-red-700',
  CONFIDENTIAL: 'bg-orange-100 text-orange-700',
  INTERNAL: 'bg-blue-100 text-blue-700',
}

interface TradeSecret {
  id: string
  title: string
  summary: string | null
  level: string
  createdBy: string
  createdAt: string
  creator: { id: string; name: string } | null
}

const PAGE_LIMIT = 10
const EMPTY_FORM = { title: '', content: '', summary: '', level: 'CONFIDENTIAL' }

export default function TradeSecretsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const { data: items, loading, error: fetchError, refresh } = useList<TradeSecret>('/api/assets/trade-secrets')
  const { create, loading: creating } = useCreate('/api/assets/trade-secrets', {
    onSuccess: () => { refresh(); showToast('success', '创建成功') },
    onError: (err) => showToast('error', err),
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')

  // 本地搜索过滤（标题/摘要）
  const filteredItems = items.filter((i: TradeSecret) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (i.title || '').toLowerCase().includes(q) ||
      (i.summary || '').toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filteredItems.length / PAGE_LIMIT) || 1
  const pagedItems = filteredItems.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const handleCreate = async () => {
    if (!form.title || !form.content) return
    const result = await create({ title: form.title, content: form.content, summary: form.summary, level: form.level })
    if (result) {
      setShowForm(false)
      setForm(EMPTY_FORM)
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b border-[var(--color-border)] sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/assets')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">技术秘密</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">+ 新增技术秘密</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {fetchError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {fetchError === '权限不足' ? '仅CEO可访问技术秘密模块' : fetchError}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索技术秘密标题 / 摘要..."
            className="w-full md:max-w-sm px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text)]"
          />
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">新增技术秘密</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">标题 *</label>
                  <input
                    type="text" value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm"
                    placeholder="核心技术名称"
                  />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">摘要</label>
                  <input
                    type="text" value={form.summary}
                    onChange={e => setForm({ ...form, summary: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm"
                    placeholder="简要描述（默认使用标题）"
                  />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">密级</label>
                  <select
                    value={form.level}
                    onChange={e => setForm({ ...form, level: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm"
                  >
                    <option value="TOP_SECRET">绝密 — 仅CEO</option>
                    <option value="CONFIDENTIAL">机密 — CEO + 研发主管</option>
                    <option value="INTERNAL">内部 — CEO + 研发主管 + 研发人员</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">
                    内容 * <span className="text-[var(--color-text-secondary)] opacity-60 font-normal">（Base64编码存储）</span>
                  </label>
                  <textarea
                    value={form.content}
                    onChange={e => setForm({ ...form, content: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm h-32"
                    placeholder="核心配方/工艺参数/技术文档..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">取消</button>
                <button
                  onClick={handleCreate}
                  disabled={!form.title || !form.content || creating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {creating ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 w-48" />
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 w-32" />
              </div>
            ))}
          </div>
        ) : fetchError && items.length === 0 ? null : items.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="empty-state-title">还没有技术秘密</div>
            <div className="empty-state-desc">技术秘密仅CEO可管理，点击新建第一个技术秘密</div>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">+ 新建第一个技术秘密</button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pagedItems.map(s => (
                <div
                  key={s.id}
                  className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md hover:border-purple-200 cursor-pointer transition"
                  onClick={() => router.push(`/assets/trade-secrets/${s.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[var(--color-text)] truncate">{s.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${LEVEL_COLORS[s.level] || ''}`}>
                          {LEVEL_LABELS[s.level] || s.level}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{s.summary || s.title}</p>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] shrink-0 ml-4 text-right">
                      <div>{s.creator?.name || '-'}</div>
                      <div className="mt-1">{formatDate(s.createdAt)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </main>
    </div>
  )
}
