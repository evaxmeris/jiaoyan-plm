'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const MARKET_LABELS: Record<string, string> = {
  CHINA: '🇨🇳 中国', EU: '🇪🇺 EU', US: '🇺🇸 美国',
  JP: '🇯🇵 日本', KR: '🇰🇷 韩国', GB: '🇬🇧 英国',
  KSA: '🇸🇦 沙特', MY: '🇲🇾 马来西亚', PH: '🇵🇭 菲律宾', RU: '🇷🇺 俄罗斯',
}

const TEST_ITEM_LABELS: Record<string, string> = {
  MICROBIAL: '微生物检测', PHYSICAL: '理化检测', STABILITY: '稳定性试验',
  SAFETY: '安全性检测', EFFICACY: '功效测评', CHALLENGE: '防腐挑战', PACKAGING: '包材相容性',
}

const MARKET_OPTIONS = Object.keys(MARKET_LABELS)
const TEST_ITEM_OPTIONS = Object.keys(TEST_ITEM_LABELS)

const defaultForm = { market: 'CHINA', testItem: 'MICROBIAL', standardValue: '', regulationRef: '', remark: '' }

export default function ComplianceStandardsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [marketFilter, setMarketFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (marketFilter) params.set('market', marketFilter)
      if (search) params.set('search', search)
      const qs = params.toString()
      const res = await apiFetch(`/api/compliance/standards${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setItems(data.data || data.complianceStandards || [])
    } catch (e: any) {
      console.error('加载合规标准失败', e)
      showToast('error', e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [marketFilter, search, showToast])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      market: item.market || 'CHINA',
      testItem: item.testItem || 'MICROBIAL',
      standardValue: item.standardValue || '',
      regulationRef: item.regulationRef || '',
      remark: item.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.standardValue.trim()) {
      showToast('error', '请填写标准值')
      return
    }
    const url = editingId ? `/api/compliance/standards/${editingId}` : '/api/compliance/standards'
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

  const handleDelete = (id: string) => setConfirmDeleteId(id)

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/compliance/standards/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  const getUniqueMarkets = () => {
    const markets = new Set(items.map(i => i.market))
    return ['', ...Object.keys(MARKET_LABELS)].filter(m => !m || markets.has(m))
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/compliance')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">检测标准配置</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新增标准</button>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 筛选栏 */}
        <div className="flex gap-3 mb-4">
          <select
            value={marketFilter}
            onChange={e => setMarketFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[140px]"
          >
            <option value="">全部市场</option>
            {MARKET_OPTIONS.map(m => (
              <option key={m} value={m}>{MARKET_LABELS[m]}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="搜索检测项目/标准值/法规依据..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        {/* 表单弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑标准' : '新增检测标准'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">目标市场 *</label>
                  <select value={form.market} onChange={e => setForm({ ...form, market: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                    {MARKET_OPTIONS.map(m => <option key={m} value={m}>{MARKET_LABELS[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检测项目 *</label>
                  <select value={form.testItem} onChange={e => setForm({ ...form, testItem: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                    {TEST_ITEM_OPTIONS.map(t => <option key={t} value={t}>{TEST_ITEM_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">标准值/限值 *</label>
                  <input type="text" value={form.standardValue} onChange={e => setForm({ ...form, standardValue: e.target.value })} placeholder="例：细菌总数≤100CFU/g" className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">法规依据</label>
                  <input type="text" value={form.regulationRef} onChange={e => setForm({ ...form, regulationRef: e.target.value })} placeholder="例：《化妆品安全技术规范》2015版" className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} placeholder="可选补充说明" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.standardValue.trim()}>
                  {editingId ? '保存修改' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 数据表格 */}
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-40" /></div>)}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <div className="empty-state-title">暂无检测标准</div>
            <div className="empty-state-desc">点击右上角"新增标准"开始配置各市场检测限值</div>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">目标市场</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">检测项目</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">标准值/限值</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">法规依据</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium">{MARKET_LABELS[item.market] || item.market}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{TEST_ITEM_LABELS[item.testItem] || item.testItem}</td>
                    <td className="px-4 py-3">{item.standardValue}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[200px] truncate" title={item.regulationRef || ''}>{item.regulationRef || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button onClick={() => openEdit(item)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button>
                        <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此检测标准记录吗？"
          confirmLabel="删除"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
