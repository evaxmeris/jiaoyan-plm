'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import Pagination from '@/components/Pagination'
import { DEFAULT_MARKET, MARKET_LABELS, MARKET_OPTIONS, MARKET_VALUES, type Market } from '@/lib/validation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const PAGE_SIZE = 20

interface RawMaterial {
  id: string; nameCn: string; unit: string; latestPrice: number | null
}

interface FormulaItem {
  id: string
  rawMaterialId: string
  rawMaterial: RawMaterial
  percentage: number
  weight: number | null
  cost: number | null
  orderIndex: number
  remark: string | null
}

interface FormulaVersion {
  id: string
  version: string
  snapshot: any
  changedBy: string
  changeLog: string
  createdAt: string
}

interface Formula {
  id: string
  name: string
  code: string
  version: string
  status: string
  targetProduct: string | null
  batchSize: number | null
  totalCost: number | null
  isCore: boolean
  processParams: string | null
  remark: string | null
  items: FormulaItem[]
  _count: { versions: number }
  createdAt: string
}

export default function FormulasPage() {
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editFormula, setEditFormula] = useState<Formula | null>(null)
  const [form, setFormData] = useState({
    name: '', batchSize: '', targetProduct: '', isCore: false, processParams: '', remark: '',
  })
  const [formItems, setFormItems] = useState<{ rawMaterialId: string; percentage: string; weight: string; cost: string }[]>([])
  const [confirmPercent, setConfirmPercent] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // 合规扫描
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<any>(null)
  const [showScanResult, setShowScanResult] = useState(false)
  const [scanResultMarket, setScanResultMarket] = useState<Market>(DEFAULT_MARKET)
  // 批次合规状态缓存（formulaId -> 整体状态）
  const [complianceMap, setComplianceMap] = useState<Record<string, { overall: string; hasProhibited: boolean; hasRestricted: boolean }>>({})
  // 合规扫描市场选择
  const [scanMarket, setScanMarket] = useState<Market>(DEFAULT_MARKET)

  // 多市场合规扫描
  const [multiMarketScanning, setMultiMarketScanning] = useState(false)
  const [multiMarketResults, setMultiMarketResults] = useState<Record<string, any>>({})
  const [showMultiMarket, setShowMultiMarket] = useState(false)
  const [multiMarketFormulaId, setMultiMarketFormulaId] = useState<string | null>(null)

  // 版本历史
  const [showVersion, setShowVersion] = useState<Formula | null>(null)
  const [versions, setVersions] = useState<FormulaVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  const router = useRouter()
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, mRes] = await Promise.all([
        apiFetch('/api/rnd/formulas'),
        apiFetch('/api/rnd/materials?q='),
      ])
      const fData = await fRes.json()
      if (!fRes.ok) throw new Error(fData.error || '加载配方失败')
      const mData = await mRes.json()
      if (!mRes.ok) throw new Error(mData.error || '加载原料失败')
      setFormulas(fData.data || fData.formulas || [])
      setMaterials(mData.rawMaterials || [])

      // 批量加载合规状态（避免 N+1 请求）
      if ((fData.data || fData.formulas)?.length > 0) {
        const ids = (fData.data || fData.formulas).map((f: Formula) => f.id)
        try {
          const cRes = await apiFetch('/api/compliance/scan-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formulaIds: ids, market: scanMarket }),
          })
          if (cRes.ok) {
            const cData = await cRes.json()
            setComplianceMap(cData.data?.results || cData.results || {})
          }
        } catch (e) {
          console.error('[ComplianceBadge] 批量合规扫描异常:', e)
        }
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) showToast('error', e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const filteredFormulas = formulas.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.code.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filteredFormulas.length / PAGE_SIZE)
  const paginatedFormulas = filteredFormulas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setEditFormula(null)
    setFormData({ name: '', batchSize: '', targetProduct: '', isCore: false, processParams: '', remark: '' })
    setFormItems([])
    setShowForm(true)
  }

  const openEdit = (f: Formula) => {
    setEditFormula(f)
    setFormData({
      name: f.name,
      batchSize: f.batchSize?.toString() || '',
      targetProduct: f.targetProduct || '',
      isCore: f.isCore,
      processParams: f.processParams || '',
      remark: f.remark || '',
    })
    setFormItems(f.items.map(i => ({
      rawMaterialId: i.rawMaterialId,
      percentage: i.percentage.toString(),
      weight: i.weight?.toString() || '',
      cost: i.cost?.toString() || '',
    })))
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/rnd/formulas/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  // 合规扫描
  const runComplianceScan = async (formulaId: string) => {
    setScanningId(formulaId)
    setScanResultMarket(scanMarket)
    try {
      const res = await apiFetch('/api/compliance/scan-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formulaId, market: scanMarket }),
      })
      if (res.ok) {
        const data = await res.json()
        setScanResult(data)
        setShowScanResult(true)
      } else {
        const err = await res.json()
        showToast('error', err.error || '扫描失败')
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) showToast('error', '合规扫描异常')
    } finally {
      setScanningId(null)
    }
  }

  // 多市场合规扫描 — 逐市场扫描配方，展示所有市场的结果对比
  const runMultiMarketScan = async (formulaId: string) => {
    setMultiMarketFormulaId(formulaId)
    setMultiMarketScanning(true)
    setShowMultiMarket(true)
    setMultiMarketResults({})

    const markets: Market[] = MARKET_VALUES as unknown as Market[]
    const results: Record<string, any> = {}

    // 并发扫描所有市场
    await Promise.all(markets.map(async (mkt) => {
      try {
        const res = await apiFetch('/api/compliance/scan-formula', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formulaId, market: mkt }),
        })
        if (res.ok) {
          const data = await res.json()
          results[mkt] = data
        } else {
          results[mkt] = { error: '扫描失败' }
        }
      } catch {
        results[mkt] = { error: '网络异常' }
      }
    }))

    setMultiMarketResults(results)
    setMultiMarketScanning(false)
  }

  const openVersionHistory = async (f: Formula) => {
    setShowVersion(f)
    setVersionsLoading(true)
    try {
      const res = await apiFetch(`/api/rnd/formulas/${f.id}`)
      const data = await res.json()
      // 直接从 FormulaVersion 表读取
      const vRes = await apiFetch('/api/rnd/formulas?id=' + f.id) // We'll fetch versions separately
      // Actually let's get versions by reading the formula detail with versions
      const detailRes = await apiFetch(`/api/rnd/formulas/versions?formulaId=${f.id}`)
      if (detailRes.ok) {
        const vData = await detailRes.json()
        setVersions(vData.data || vData.versions || [])
      } else {
        // Fallback: try another approach
        setVersions([])
      }
    } catch (e) {
      console.error(e)
      setVersions([])
    }
    setVersionsLoading(false)
  }

  // 获取版本历史
  const fetchVersions = useCallback(async (formulaId: string) => {
    setVersionsLoading(true)
    try {
      const res = await apiFetch(`/api/rnd/formulas/versions?formulaId=${formulaId}`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.data?.versions || data.versions || [])
      } else {
        setVersions([])
      }
    } catch {
      setVersions([])
    }
    setVersionsLoading(false)
  }, [])

  useEffect(() => {
    if (showVersion) fetchVersions(showVersion.id)
  }, [showVersion, fetchVersions])

  const handleSubmit = async () => {
    const items = formItems.filter(i => i.rawMaterialId).map(i => ({
      rawMaterialId: i.rawMaterialId,
      percentage: parseFloat(i.percentage) || 0,
      weight: i.weight ? parseFloat(i.weight) : null,
      cost: i.cost ? parseFloat(i.cost) : null,
    }))

    const totalPct = items.reduce((s, i) => s + i.percentage, 0)
    if (Math.abs(totalPct - 100) > 0.5 && items.some(i => i.percentage > 0)) {
      setConfirmPercent(true)
      setPendingSubmit(() => async () => {
        await doSubmit(items)
      })
      return
    }

    await doSubmit(items)
  }

  const doSubmit = async (items: any[]) => {
    const payload = { ...form, batchSize: form.batchSize ? parseFloat(form.batchSize) : null, items }
    const url = editFormula ? `/api/rnd/formulas/${editFormula.id}` : '/api/rnd/formulas'
    const method = editFormula ? 'PUT' : 'POST'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setShowForm(false)
      setEditFormula(null)
      setFormData({ name: '', batchSize: '', targetProduct: '', isCore: false, processParams: '', remark: '' })
      setFormItems([])
      fetchData()
    } else {
      const err = await res.json()
      showToast('error', err.error || '保存失败')
    }
  }

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      DEVELOPING: '研发中', SAMPLING: '打样中', TESTING: '送检中',
      STABILIZED: '已定型', DISCONTINUED: '已停用',
    }
    return labels[s] || s
  }

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      DEVELOPING: 'bg-blue-100 text-blue-700',
      SAMPLING: 'bg-yellow-100 text-yellow-700',
      TESTING: 'bg-orange-100 text-orange-700',
      STABILIZED: 'bg-green-100 text-green-700',
      DISCONTINUED: 'bg-gray-100 text-gray-500',
    }
    return colors[s] || 'bg-[var(--color-card)]'
  }

  // 合规状态徽章
  const complianceBadge = (formulaId: string) => {
    const c = complianceMap[formulaId]
    if (!c) return null
    if (c.hasProhibited) {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">❌ 禁用</span>
    }
    if (c.hasRestricted) {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">⚠️ 有风险</span>
    }
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">✅ 合规</span>
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">配方管理</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">合规市场：</label>
              <select
                value={scanMarket}
                onChange={e => setScanMarket(e.target.value as Market)}
                className="px-2 py-1 text-xs border border-[var(--color-border)] rounded bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {MARKET_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建配方</button>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 搜索框 */}
        <div className="mb-4">
          <input type="text" placeholder="搜索配方名称 / 编号..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
        </div>

        {/* 新建/编辑 配方弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editFormula ? '编辑配方' : '新建配方'}</h2>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">配方名称 *</label>
                  <input type="text" value={form.name} onChange={e => setFormData({...form, name: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">目标产品</label>
                  <input type="text" value={form.targetProduct} onChange={e => setFormData({...form, targetProduct: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="产品名称" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">批量(g/kg)</label>
                  <input type="text" value={form.batchSize} onChange={e => setFormData({...form, batchSize: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={form.isCore} onChange={e => setFormData({...form, isCore: e.target.checked})} />
                  <label className="text-sm text-[var(--color-text-secondary)]">核心保密配方（成分对非授权用户隐藏）</label>
                </div>
              </div>

              {/* 原料成分 */}
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">配方成分（总占比: {formItems.reduce((s, it) => s + (parseFloat(it.percentage) || 0), 0).toFixed(1)}%）</h3>
              <div className="space-y-2 mb-3">
                {formItems.map((item, i) => {
                  const mat = materials.find(m => m.id === item.rawMaterialId)
                  const unitPrice = mat?.latestPrice ?? null
                  const pct = parseFloat(item.percentage) || 0
                  const autoCost = unitPrice != null && pct > 0
                    ? Math.round((pct / 100) * unitPrice * 100) / 100
                    : null
                  return (
                    <div key={i} className="flex gap-2 items-center text-sm">
                      <select
                        value={item.rawMaterialId}
                        onChange={e => {
                          const items = [...formItems]
                          items[i].rawMaterialId = e.target.value
                          setFormItems(items)
                        }}
                        className="flex-1 px-3 py-1.5 border rounded text-sm"
                      >
                        <option value="">选择原料</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.nameCn}</option>
                        ))}
                      </select>
                      <input type="number" step="0.01" placeholder="%" value={item.percentage}
                        onChange={e => {
                          const items = [...formItems]
                          items[i].percentage = e.target.value
                          setFormItems(items)
                        }}
                        className="w-16 px-2 py-1.5 border rounded text-sm text-right" />
                      {unitPrice != null ? (
                        <span className="text-xs text-emerald-600 whitespace-nowrap" title="该原料行当前采购价">
                          ¥{unitPrice}/{mat?.unit || 'kg'}
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 whitespace-nowrap" title="该原料未录价格，成本按 0 计">未定价</span>
                      )}
                      <input
                        type="number" step="0.01"
                        placeholder={autoCost != null ? `自动 ¥${autoCost}` : ''}
                        value={item.cost}
                        onChange={e => {
                          const items = [...formItems]
                          items[i].cost = e.target.value
                          setFormItems(items)
                        }}
                        title="成本（元/单位产品，默认按占比×单价自动计算，可手动覆盖）"
                        className="w-24 px-2 py-1.5 border rounded text-sm text-right"
                      />
                      <button onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} className="text-red-400 text-xs">删除</button>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setFormItems([...formItems, { rawMaterialId: '', percentage: '', weight: '', cost: '' }])}
                className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 block">+ 添加原料</button>

              <div className="mb-4">
                <label className="block text-[var(--color-text-secondary)] mb-1 text-sm">工艺参数</label>
                <textarea value={form.processParams} onChange={e => setFormData({...form, processParams: e.target.value})}
                  className="w-full px-3 py-1.5 border rounded text-sm" rows={2} placeholder="温度、顺序、时间..." />
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSubmit} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm" disabled={!form.name}>
                  {editFormula ? '保存修改' : '保存配方'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 版本历史弹窗 */}
        {showVersion && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowVersion(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{showVersion.name} - 版本历史</h2>
                <button onClick={() => setShowVersion(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] text-sm">关闭</button>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mb-3">配方编号: {showVersion.code} · 当前版本: v{showVersion.version}</div>

              {versionsLoading ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">加载中...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">暂无版本历史</div>
              ) : (
                <div className="space-y-3">
                  {versions.map(v => (
                    <div key={v.id} className="border rounded-lg p-3 bg-[var(--color-bg)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">版本 {v.version}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{new Date(v.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        <span>修改人: {v.changedBy}</span>
                        <span className="ml-3">说明: {v.changeLog}</span>
                      </div>
                      {v.snapshot?.items && (
                        <details className="mt-2">
                          <summary className="text-xs text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-secondary)]">查看成分快照 ({v.snapshot.items.length} 项)</summary>
                          <div className="mt-1 text-xs">
                            <table className="w-full">
                              <thead><tr className="text-[var(--color-text-secondary)]"><th className="text-left">原料</th><th className="text-right">占比</th></tr></thead>
                              <tbody>
                                {v.snapshot.items.map((si: any, idx: number) => (
                                  <tr key={idx}><td className="py-0.5">{si.rawMaterial?.nameCn || '-'}</td><td className="text-right">{si.percentage}%</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 配方列表 */}
        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : formulas.length === 0 ? (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
            <div className="empty-state-title">还没有配方</div>
            <div className="empty-state-desc">还没有配方，先添加原料再创建配方</div>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建第一个配方</button>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedFormulas.map(f => (
              <div key={f.id} className="bg-[var(--color-card)] rounded-xl border p-4 hover:shadow-sm transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{f.name}</h3>
                      <span className="text-xs text-[var(--color-text-secondary)]">{f.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(f.status)}`}>{statusLabel(f.status)}</span>
                      {f.isCore && <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">核心</span>}
                      {complianceBadge(f.id)}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {f.version} · {f.items.length} 种成分 · {f._count.versions} 次版本 · {f.batchSize ? `${f.batchSize}g` : '-'}
                      {f.targetProduct && <span> · 目标: {f.targetProduct}</span>}
                      <span className="ml-3 font-medium text-emerald-600">单位成本 ¥{f.totalCost ?? 0}</span>
                      {f.items.filter(it => (it.rawMaterial?.latestPrice ?? null) == null).length > 0 && (
                        <span className="ml-2 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {f.items.filter(it => (it.rawMaterial?.latestPrice ?? null) == null).length} 项未定价
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); runComplianceScan(f.id) }}
                      disabled={scanningId === f.id}
                      className="px-3 py-1 text-xs border rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {scanningId === f.id ? '扫描中...' : '合规扫描'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); runMultiMarketScan(f.id) }}
                      className="px-3 py-1 text-xs border rounded text-blue-600 hover:bg-blue-50"
                    >
                      多市场合规
                    </button>
                    <button onClick={() => openEdit(f)} className="px-3 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                    <button onClick={() => handleDelete(f.id)} className="px-3 py-1 text-xs border rounded text-red-500 hover:bg-red-50">删除</button>
                    <button onClick={() => openVersionHistory(f)} className="px-3 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">版本历史{f._count.versions > 0 ? ` (${f._count.versions})` : ''}</button>
                  </div>
                </div>
                {/* 成分预览 + 成本构成 */}
                {f.items.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[var(--color-text-secondary)]">
                          <th className="text-left pb-1">原料</th>
                          <th className="text-right pb-1">占比</th>
                          <th className="text-right pb-1">单价</th>
                          <th className="text-right pb-1">成本</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.items.map(item => {
                          const unitPrice = item.rawMaterial?.latestPrice ?? null
                          return (
                            <tr key={item.id}>
                              <td className="py-0.5">
                                {item.rawMaterial?.nameCn || '-'}
                                {unitPrice == null && (
                                  <span className="ml-1 text-[10px] text-red-500">未定价</span>
                                )}
                              </td>
                              <td className="text-right">{item.percentage}%</td>
                              <td className="text-right">
                                {unitPrice != null ? (
                                  <span className="text-emerald-600">¥{unitPrice}</span>
                                ) : (
                                  <span className="text-red-400">—</span>
                                )}
                              </td>
                              <td className="text-right">{item.cost != null ? `¥${item.cost}` : '—'}</td>
                            </tr>
                          )
                        })}
                        <tr className="border-t border-[var(--color-border)] font-medium">
                          <td className="py-1">单位成本合计</td>
                          <td className="text-right">{f.items.reduce((s, it) => s + (it.percentage || 0), 0).toFixed(1)}%</td>
                          <td />
                          <td className="text-right text-emerald-600">¥{f.totalCost ?? 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))} 
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </main>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此配方吗？此操作将软删除配方，可恢复。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* 成分占比偏差确认（占比≠100% 时提示，缺失此弹窗会导致保存静默卡死） */}
      <ConfirmDialog
        open={confirmPercent}
        title="成分占比偏差"
        message="配方成分百分比总和与 100% 存在偏差，确认继续保存吗？"
        confirmLabel="确认保存"
        onConfirm={() => { setConfirmPercent(false); pendingSubmit?.() }}
        onCancel={() => setConfirmPercent(false)}
      />

      {/* 合规扫描结果 */}
      {showScanResult && scanResult && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowScanResult(false)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">合规扫描结果</h2>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">{MARKET_LABELS[scanResultMarket]}</span>
                <button onClick={() => setShowScanResult(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] text-sm">关闭</button>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-3">{scanResult.formulaName}</div>

            {/* 总体状态 */}
            <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${
              scanResult.overall === 'PASS' ? 'bg-green-50 text-green-700 border border-green-200' :
              scanResult.overall === 'WARN' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
              scanResult.overall === 'FAIL' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-gray-50 text-gray-700 border border-gray-200'
            }`}>
              {scanResult.overall === 'PASS' && '✅ 合规 — 所有成分均未匹配到禁用/限用清单'}
              {scanResult.overall === 'WARN' && '⚠️ 存在风险 — 部分成分受限制，请查看详情'}
              {scanResult.overall === 'FAIL' && '🚫 禁用成分 — 配方中存在禁用成分！'}
            </div>

            {/* 摘要 */}
            <div className="flex gap-3 mb-4 text-sm">
              <span className="px-2 py-1 rounded bg-green-100 text-green-700">通过 {scanResult.summary?.passed || 0}</span>
              <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">有风险 {scanResult.summary?.warned || 0}</span>
              <span className="px-2 py-1 rounded bg-red-100 text-red-700">禁用 {scanResult.summary?.failed || 0}</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">合计 {scanResult.summary?.total || 0}</span>
            </div>

            {/* 详细列表 */}
            <div className="space-y-2">
              {scanResult.results?.map((r: any, idx: number) => (
                <div key={idx} className={`border rounded-lg p-3 ${
                  r.result === 'FAIL' ? 'border-red-200 bg-red-50' :
                  r.result === 'WARN' ? 'border-yellow-200 bg-yellow-50' :
                  r.result === 'PASS' ? 'border-green-200 bg-green-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${
                      r.result === 'FAIL' ? 'bg-red-500' :
                      r.result === 'WARN' ? 'bg-yellow-500' :
                      r.result === 'PASS' ? 'bg-green-500' :
                      'bg-gray-400'
                    }`} />
                    <span className="font-medium text-sm">{r.rawMaterial?.nameCn || r.rawMaterialName || '-'}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{r.rawMaterial?.casNo ? `CAS: ${r.rawMaterial.casNo}` : ''}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">（占比 {r.ingredientPercentage}%）</span>
                  </div>
                  {r.result === 'FAIL' && (
                    <div className="text-xs text-red-600 mt-1">
                      {r.regulation && (
                        <>
                          <div>禁用成分：{r.regulation.nameCn}</div>
                          <div>法规来源：{r.regulation.sourceRegulation}</div>
                        </>
                      )}
                      <div className="text-red-700 font-medium mt-1">⛔ 禁止使用</div>
                    </div>
                  )}
                  {r.result === 'WARN' && (
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {r.regulation && (
                        <>
                          <div>法规来源：{r.regulation.sourceRegulation}</div>
                          {r.regulation.maxConcentration != null && <div>最大允许浓度：{r.regulation.maxConcentration}%</div>}
                          {r.regulation.restrictionNote && <div>限制说明：{r.regulation.restrictionNote}</div>}
                        </>
                      )}
                    </div>
                  )}
                  {r.result === 'PASS' && (
                    <div className="text-xs text-green-600 mt-1">准用成分，合规通过</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 多市场合规扫描结果面板 */}
      {showMultiMarket && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowMultiMarket(false)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">多市场合规扫描</h2>
              <button onClick={() => setShowMultiMarket(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] text-sm">关闭</button>
            </div>

            {multiMarketScanning ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                <div className="text-[var(--color-text-secondary)] text-sm">正在扫描全部 {MARKET_VALUES.length} 个市场...</div>
              </div>
            ) : (
              <>
                {/* 市场一览摘要 */}
                <div className="grid grid-cols-5 gap-2 mb-6">
                  {MARKET_VALUES.map((mkt: string) => {
                    const mr = multiMarketResults[mkt]
                    const overall = mr?.data?.overall || mr?.overall
                    const noData = !mr || mr.error
                    return (
                      <div key={mkt} className={`border rounded-lg p-3 text-center ${
                        noData ? 'border-gray-200 bg-gray-50' :
                        overall === 'PASS' ? 'border-green-200 bg-green-50' :
                        overall === 'WARN' ? 'border-yellow-200 bg-yellow-50' :
                        'border-red-200 bg-red-50'
                      }`}>
                        <div className="text-xs font-medium mb-1">{MARKET_LABELS[mkt as Market] || mkt}</div>
                        {noData ? (
                          <div className="text-xs text-gray-500">❌ 失败</div>
                        ) : overall === 'PASS' ? (
                          <div className="text-xs text-green-700">✅ 合规</div>
                        ) : overall === 'WARN' ? (
                          <div className="text-xs text-yellow-700">⚠️ 有风险</div>
                        ) : (
                          <div className="text-xs text-red-700">❌ 禁用</div>
                        )}
                        {!noData && (
                          <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                            {mr.summary?.passed || 0}/{mr.summary?.total || 0} 通过
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 按市场展开的详细结果 */}
                <div className="space-y-4">
                  {MARKET_VALUES.filter((mkt: string) => multiMarketResults[mkt] && !multiMarketResults[mkt].error).map((mkt: string) => {
                    const mr = multiMarketResults[mkt]
                    const data = mr.data || mr
                    return (
                      <details key={mkt} className="border rounded-lg" open={data.overall !== 'PASS'}>
                        <summary className={`px-4 py-2 cursor-pointer text-sm font-medium rounded-t-lg flex items-center gap-2 ${
                          data.overall === 'PASS' ? 'bg-green-50 text-green-700' :
                          data.overall === 'WARN' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          <span>{MARKET_LABELS[mkt as Market] || mkt}</span>
                          <span className="text-xs font-normal">({data.summary?.passed || 0}/{data.summary?.total || 0} 通过)</span>
                        </summary>
                        <div className="p-4 space-y-2">
                          {data.results?.map((r: any, idx: number) => (
                            <div key={idx} className={`border rounded p-2 text-xs ${
                              r.result === 'FAIL' ? 'border-red-200 bg-red-50/50' :
                              r.result === 'WARN' ? 'border-yellow-200 bg-yellow-50/50' :
                              'border-green-200 bg-green-50/50'
                            }`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full inline-block ${
                                  r.result === 'FAIL' ? 'bg-red-500' :
                                  r.result === 'WARN' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`} />
                                <span className="font-medium">{r.rawMaterial?.nameCn || r.rawMaterialName || '-'}</span>
                                <span className="text-[var(--color-text-secondary)]">
                                  {r.rawMaterial?.casNo ? `CAS: ${r.rawMaterial.casNo}` : ''}
                                </span>
                              </div>
                              {r.regulation && (
                                <div className="mt-1 text-[var(--color-text-secondary)]">
                                  <span>{r.regulation.nameCn} · {r.regulation.sourceRegulation}</span>
                                  {r.regulation.maxConcentration != null && <span> · 上限: {r.regulation.maxConcentration}%</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )
                  })}
                </div>

                {/* 扫描失败的市场 */}
                {MARKET_VALUES.filter((mkt: string) => multiMarketResults[mkt]?.error).length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 border rounded-lg">
                    <div className="text-xs text-gray-500">
                      以下市场扫描失败：{MARKET_VALUES.filter((mkt: string) => multiMarketResults[mkt]?.error).map((m: string) => MARKET_LABELS[m as Market]).join('、')}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
