'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const LEVEL_LABELS: Record<string, string> = { TOP_SECRET: '绝密', CONFIDENTIAL: '机密', INTERNAL: '内部' }
const LEVEL_COLORS: Record<string, string> = { TOP_SECRET: 'bg-red-100 text-red-700', CONFIDENTIAL: 'bg-orange-100 text-orange-700', INTERNAL: 'bg-blue-100 text-blue-700' }

export default function TradeSecretDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', summary: '', level: 'CONFIDENTIAL' })
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/api/assets/trade-secrets/${id}`)
    if (!res.ok) { setError('加载失败'); setLoading(false); return }
    const json = await res.json()
    setData(json.data?.secret || json.secret)
    setForm({ title: json.secret.title, content: json.secret.content, summary: json.secret.summary || '', level: json.secret.level })
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const handleUpdate = async () => {
    const res = await apiFetch(`/api/assets/trade-secrets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setError('更新失败'); return }
    setEditing(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!confirm('确认删除此技术秘密？')) return
    const res = await apiFetch(`/api/assets/trade-secrets/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('删除失败'); return }
    router.push('/assets/trade-secrets')
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN')

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">加载中...</div>
  if (!data || error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">{error || '技术秘密不存在'}</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/assets/trade-secrets')} className="text-gray-400 hover:text-gray-600">&larr; 返回</button>
            <h1 className="text-xl font-bold text-gray-800 truncate">{data.title}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[data.level] || ''}`}>{LEVEL_LABELS[data.level] || data.level}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setEditing(!editing)} className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200">
              {editing ? '取消编辑' : '编辑'}
            </button>
            <button onClick={handleDelete} className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200">删除</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 编辑模式 */}
        {editing ? (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">编辑技术秘密</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-500 mb-1">标题 *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">摘要</label>
                <input type="text" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">密级</label>
                <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                  <option value="TOP_SECRET">绝密</option>
                  <option value="CONFIDENTIAL">机密</option>
                  <option value="INTERNAL">内部</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 mb-1">内容 * <span className="text-gray-400 font-normal">（Base64编码存储）</span></label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm h-48 font-mono" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-500 text-sm">取消</button>
              <button onClick={handleUpdate} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" disabled={!form.title || !form.content}>保存</button>
            </div>
          </div>
        ) : (
          /* 查看模式 */
          <>
            {/* 内容卡片 */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">技术内容（Base64编码存储）</h2>
              <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm leading-relaxed font-mono">
                {data.content || '(无内容)'}
              </div>
            </div>

            {/* 元信息 */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">元信息</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">摘要</span>
                  <p className="font-medium mt-0.5">{data.summary || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">密级</span>
                  <p className="mt-0.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[data.level] || ''}`}>{LEVEL_LABELS[data.level] || data.level}</span></p>
                </div>
                <div>
                  <span className="text-gray-400">创建人</span>
                  <p className="font-medium mt-0.5">{data.creator?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">创建时间</span>
                  <p className="font-medium mt-0.5">{formatDate(data.createdAt)}</p>
                </div>
                <div>
                  <span className="text-gray-400">更新时间</span>
                  <p className="font-medium mt-0.5">{formatDate(data.updatedAt)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
