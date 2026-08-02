'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Pagination from '@/components/Pagination'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const PAGE_SIZE = 20

const MARKET_LABELS: Record<string, string> = {
  CHINA: '中国', EU: 'EU', US: '美国', JP: '日本', KR: '韩国',
  MY: '马来西亚', PH: '菲律宾', KSA: '沙特', RU: '俄罗斯', GB: '英国',
}

const MARKET_OPTIONS = [
  { value: '', label: '全部市场' },
  ...Object.entries(MARKET_LABELS).map(([k, v]) => ({ value: k, label: v })),
]

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'PROHIBITED', label: '禁用' },
  { value: 'RESTRICTED', label: '限用' },
  { value: 'ALLOWED', label: '准用' },
]

const TYPE_STYLES: Record<string, string> = {
  PROHIBITED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RESTRICTED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ALLOWED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const TYPE_LABELS: Record<string, string> = {
  PROHIBITED: '禁用', RESTRICTED: '限用', ALLOWED: '准用',
}

const COMMON_FUNCTIONS = [
  { value: '', label: '全部功能' },
  { value: '防腐剂', label: '防腐剂' },
  { value: '防晒剂', label: '防晒剂' },
  { value: '美白剂', label: '美白剂' },
  { value: '抗氧化剂', label: '抗氧化剂' },
  { value: '保湿剂', label: '保湿剂' },
  { value: '着色剂', label: '着色剂' },
  { value: '染发剂', label: '染发剂' },
  { value: '表面活性剂', label: '表面活性剂' },
  { value: '螯合剂', label: '螯合剂' },
  { value: '溶剂', label: '溶剂' },
  { value: 'pH调节剂', label: 'pH调节剂' },
  { value: '香精香料', label: '香精香料' },
]

interface Regulation {
  id: string
  nameCn: string
  nameEn: string | null
  inciName: string | null
  casNo: string | null
  regulationType: string
  market: string
  maxConcentration: number | null
  productTypeRestriction: string | null
  restrictionNote: string | null
  sourceRegulation: string
  category: string | null
  scope: string | null
  ingredientFunction: string | null
  referenceFile: string | null
}

const defaultForm = {
  nameCn: '',
  nameEn: '',
  inciName: '',
  casNo: '',
  regulationType: 'PROHIBITED',
  market: 'CHINA',
  maxConcentration: '',
  productTypeRestriction: '',
  restrictionNote: '',
  sourceRegulation: '',
  category: '',
  scope: '',
  ingredientFunction: '',
  referenceFile: '',
}

export default function RegulationsPage() {
  const [regulations, setRegulations] = useState<Regulation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [functionFilter, setFunctionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 导入状态
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ total: number; imported: number; updated: number; skipped: number; errors: any[] } | null>(null)

  // 统计信息
  const [stats, setStats] = useState<{ total: number; prohibited: number; restricted: number; allowed: number; chinese: number; eu: number }>({ total: 0, prohibited: 0, restricted: 0, allowed: 0, chinese: 0, eu: 0 })

  const router = useRouter()
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (marketFilter) params.set('market', marketFilter)
      if (typeFilter) params.set('regulationType', typeFilter)
      if (functionFilter) params.set('ingredientFunction', functionFilter)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      const res = await fetch(`/api/compliance/ingredient-regulations?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载法规失败')
      setRegulations(data.ingredientRegulations || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (e: any) {
      showToast('error', e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [search, marketFilter, typeFilter, functionFilter, page, showToast])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/compliance/ingredient-regulations?limit=1')
      const data = await res.json()
      if (data.pagination) {
        setStats(prev => ({ ...prev, total: data.pagination.total }))
      }
      // 获取各类别的统计数据
      const [prohibited, restricted, allowed, chinese, eu] = await Promise.all([
        fetch('/api/compliance/ingredient-regulations?regulationType=PROHIBITED&limit=1').then(r => r.json()),
        fetch('/api/compliance/ingredient-regulations?regulationType=RESTRICTED&limit=1').then(r => r.json()),
        fetch('/api/compliance/ingredient-regulations?regulationType=ALLOWED&limit=1').then(r => r.json()),
        fetch('/api/compliance/ingredient-regulations?market=CHINA&limit=1').then(r => r.json()),
        fetch('/api/compliance/ingredient-regulations?market=EU&limit=1').then(r => r.json()),
      ])
      setStats({
        total: data.pagination?.total || 0,
        prohibited: prohibited.pagination?.total || 0,
        restricted: restricted.pagination?.total || 0,
        allowed: allowed.pagination?.total || 0,
        chinese: chinese.pagination?.total || 0,
        eu: eu.pagination?.total || 0,
      })
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchStats() }, [])
  useEffect(() => { setPage(1) }, [search, marketFilter, typeFilter, functionFilter])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (r: Regulation) => {
    setEditingId(r.id)
    setForm({
      nameCn: r.nameCn,
      nameEn: r.nameEn || '',
      inciName: r.inciName || '',
      casNo: r.casNo || '',
      regulationType: r.regulationType,
      market: r.market,
      maxConcentration: r.maxConcentration != null ? String(r.maxConcentration) : '',
      productTypeRestriction: r.productTypeRestriction || '',
      restrictionNote: r.restrictionNote || '',
      sourceRegulation: r.sourceRegulation,
      category: r.category || '',
      scope: r.scope || '',
      ingredientFunction: r.ingredientFunction || '',
      referenceFile: r.referenceFile || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.nameCn.trim()) {
      showToast('error', '请输入中文名称')
      return
    }
    if (!form.sourceRegulation.trim()) {
      showToast('error', '请输入法规来源')
      return
    }

    setSaving(true)
    try {
      const body: any = {
        nameCn: form.nameCn.trim(),
        nameEn: form.nameEn.trim() || null,
        inciName: form.inciName.trim() || null,
        casNo: form.casNo.trim() || null,
        regulationType: form.regulationType,
        market: form.market,
        maxConcentration: form.maxConcentration ? parseFloat(form.maxConcentration) : null,
        productTypeRestriction: form.productTypeRestriction.trim() || null,
        restrictionNote: form.restrictionNote.trim() || null,
        sourceRegulation: form.sourceRegulation.trim(),
        category: form.category.trim() || null,
        scope: form.scope.trim() || null,
        ingredientFunction: form.ingredientFunction.trim() || null,
        referenceFile: form.referenceFile.trim() || null,
      }

      const url = editingId
        ? `/api/compliance/ingredient-regulations/${editingId}`
        : '/api/compliance/ingredient-regulations'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (editingId ? '更新失败' : '创建失败'))

      showToast('success', editingId ? '更新成功' : '创建成功')
      setShowForm(false)
      setEditingId(null)
      fetchData()
      fetchStats()
    } catch (e: any) {
      showToast('error', e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/compliance/ingredient-regulations/${confirmDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '删除失败')
      }
      showToast('success', '删除成功')
      setConfirmDeleteId(null)
      fetchData()
      fetchStats()
    } catch (e: any) {
      showToast('error', e.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 导出
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (marketFilter) params.set('market', marketFilter)
      if (typeFilter) params.set('regulationType', typeFilter)

      const res = await fetch(`/api/compliance/ingredient-regulations/export?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '导出失败')

      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.exportInfo?.fileName || 'ingredient-regulations-export.json'
      a.click()
      URL.revokeObjectURL(url)
      showToast('success', `已导出 ${data.exportInfo?.totalCount || 0} 条记录`)
    } catch (e: any) {
      showToast('error', e.message || '导出失败')
    }
  }

  // 文件导入
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      let records: any[]
      try {
        const parsed = JSON.parse(text)
        records = Array.isArray(parsed) ? parsed : parsed.records || parsed.ingredientRegulations || [parsed]
      } catch {
        showToast('error', 'JSON 解析失败，请检查文件格式')
        setImporting(false)
        return
      }

      // 自动映射 function → ingredientFunction
      for (const r of records) {
        if (r.function && !r.ingredientFunction) {
          r.ingredientFunction = r.function
        }
      }

      const res = await fetch('/api/compliance/ingredient-regulations/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '导入失败')

      setImportResult(result)
      showToast('success', `导入完成：${result.imported} 条新建, ${result.updated} 条更新`)
      fetchData()
      fetchStats()
    } catch (e: any) {
      showToast('error', e.message || '导入失败')
    } finally {
      setImporting(false)
      // 重置 input 以允许重复选择同一文件
      e.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/compliance')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">法规数据库</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              📥 导出
            </button>
            <label className={`px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              {importing ? '⏳ 导入中...' : '📄 导入JSON'}
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
                disabled={importing}
              />
            </label>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              + 新增法规
            </button>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div className="bg-[var(--color-card)] rounded-xl border p-3 text-center">
            <div className="text-2xl font-bold text-[var(--color-text)]">{stats.total.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">总条数</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.prohibited.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">禁用</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.restricted.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">限用</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.allowed.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">准用</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.chinese.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">中国</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.eu.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">欧盟</div>
          </div>
        </div>

        {/* 导入结果提示 */}
        {importResult && (
          <div className={`mb-4 p-4 rounded-lg border ${
            importResult.errors?.length > 0
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">导入完成</span>
                <span className="text-sm ml-2">
                  共 {importResult.total} 条 — 新建 {importResult.imported} 条, 更新 {importResult.updated} 条
                  {importResult.skipped > 0 && `, 跳过 ${importResult.skipped} 条`}
                </span>
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                ✕
              </button>
            </div>
            {importResult.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-yellow-600 cursor-pointer">查看错误详情 ({importResult.errors.length} 条)</summary>
                <div className="mt-1 max-h-32 overflow-y-auto text-xs text-yellow-700 space-y-1">
                  {importResult.errors.map((e: any, i: number) => (
                    <div key={i}>#{e.index} {e.nameCn}: {e.error}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 筛选和搜索区域 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={marketFilter}
            onChange={e => setMarketFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-[var(--color-card)]"
          >
            {MARKET_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-[var(--color-card)]"
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={functionFilter}
            onChange={e => setFunctionFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-[var(--color-card)]"
          >
            {COMMON_FUNCTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="搜索中文名称 / CAS号 / INCI / 功能..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-[var(--color-card)]"
          />
        </div>

        {/* 新增/编辑表单模态框 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑法规' : '新增法规'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">市场 *</label>
                  <select value={form.market} onChange={e => setForm({...form, market: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]">
                    {Object.entries(MARKET_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">法规类型 *</label>
                  <select value={form.regulationType} onChange={e => setForm({...form, regulationType: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]">
                    <option value="PROHIBITED">禁用</option>
                    <option value="RESTRICTED">限用</option>
                    <option value="ALLOWED">准用</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">中文名称 *</label>
                  <input type="text" value={form.nameCn} onChange={e => setForm({...form, nameCn: e.target.value})} placeholder="必填" className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">英文名称</label>
                  <input type="text" value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">INCI名称</label>
                  <input type="text" value={form.inciName} onChange={e => setForm({...form, inciName: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">CAS号</label>
                  <input type="text" value={form.casNo} onChange={e => setForm({...form, casNo: e.target.value})} placeholder="如 123-45-6" className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">原料功能</label>
                  <select value={form.ingredientFunction} onChange={e => setForm({...form, ingredientFunction: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]">
                    <option value="">请选择</option>
                    {COMMON_FUNCTIONS.filter(f => f.value).map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">适用范围</label>
                  <input type="text" value={form.scope} onChange={e => setForm({...form, scope: e.target.value})} placeholder="如 驻留类/淋洗类" className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">最大浓度（%）</label>
                  <input type="number" step="0.01" min="0" value={form.maxConcentration} onChange={e => setForm({...form, maxConcentration: e.target.value})} placeholder="限用时填写" className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">产品类型限制</label>
                  <input type="text" value={form.productTypeRestriction} onChange={e => setForm({...form, productTypeRestriction: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">限制说明</label>
                  <textarea value={form.restrictionNote} onChange={e => setForm({...form, restrictionNote: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" rows={2} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">法规来源 *</label>
                  <input type="text" value={form.sourceRegulation} onChange={e => setForm({...form, sourceRegulation: e.target.value})} placeholder="必填" className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[var(--color-text-secondary)] mb-1">分类</label>
                  <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">法规原文引用</label>
                  <input type="text" value={form.referenceFile} onChange={e => setForm({...form, referenceFile: e.target.value})} placeholder="文件路径或URL" className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-[var(--color-card)]" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={saving || !form.nameCn.trim() || !form.sourceRegulation.trim()}>
                  {saving ? '保存中...' : editingId ? '保存修改' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 数据表格 */}
        {loading ? (
          <div className="space-y-3 p-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : regulations.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div className="empty-state-title">暂无法规数据</div>
            <div className="empty-state-desc">点击"新增法规"添加第一条记录，或点击"导入JSON"批量导入法规数据</div>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新增法规</button>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium w-12">#</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">市场</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">中文名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">英文名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">CAS号</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">类型</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">原料功能</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">浓度限制</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">限制说明</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {regulations.map((r, idx) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{(page - 1) * 20 + idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {MARKET_LABELS[r.market] || r.market}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{r.nameCn}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{r.nameEn || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{r.casNo || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[r.regulationType] || ''}`}>
                        {TYPE_LABELS[r.regulationType] || r.regulationType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{r.ingredientFunction || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                      {r.maxConcentration != null ? `${r.maxConcentration}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs max-w-[200px] truncate" title={r.restrictionNote || ''}>
                      {r.restrictionNote || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(r)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">编辑</button>
                        <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">删除</button>
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
          message="确定要删除此法规条目吗？此操作不可撤销。"
          confirmLabel={deleting ? '删除中...' : '删除'}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
