'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const RESULT_LABELS: Record<string, string> = {
  PENDING: '待检',
  PASS: '通过',
  CONDITIONAL: '让步接收',
  FAIL: '不合格',
}

const RESULT_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  PASS: 'text-green-600 bg-green-50',
  CONDITIONAL: 'text-blue-600 bg-blue-50',
  FAIL: 'text-red-600 bg-red-50',
}

const DISPOSITION_LABELS_IQC: Record<string, string> = {
  USE_AS_IS: '让步使用',
  RETURN: '退回',
  SCRAP: '报废',
}

const IPQC_STAGE_LABELS: Record<string, string> = {
  PRODUCTION: '生产',
  FILLING: '灌装',
  PACKAGING: '包装',
  LABELING: '标签',
}

const OQC_DISPOSITION_LABELS: Record<string, string> = {
  PASS: '放行',
  REWORK: '返工',
  SCRAP: '报废',
}

type Tab = 'iqc' | 'ipqc' | 'oqc'

export default function QualityPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('iqc')

  // ── IQC 状态 ──
  const [iqcItems, setIqcItems] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [iqcSearch, setIqcSearch] = useState('')
  const [iqcResultFilter, setIqcResultFilter] = useState('')
  const [iqcLoading, setIqcLoading] = useState(true)
  const [iqcForm, setIqcForm] = useState<any>({
    rawMaterialId: '', batchId: '', supplierBatchNo: '', quantityReceived: '',
    unit: 'kg', receiptDate: new Date().toISOString().slice(0, 10),
    coaVerified: false, coaResult: '', sampleQty: '', sampleLocation: '',
    samplePerson: '', inspectionDate: '', inspector: '', result: 'PENDING',
    nonConformity: '', disposition: '', remark: '',
  })
  const [iqcShowForm, setIqcShowForm] = useState(false)
  const [iqcShowDetail, setIqcShowDetail] = useState<any>(null)

  // ── IPQC 状态 ──
  const [ipqcItems, setIpqcItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [oemContracts, setOemContracts] = useState<any[]>([])
  const [ipqcSearch, setIpqcSearch] = useState('')
  const [ipqcResultFilter, setIpqcResultFilter] = useState('')
  const [ipqcStageFilter, setIpqcStageFilter] = useState('')
  const [ipqcLoading, setIpqcLoading] = useState(true)
  const [ipqcShowForm, setIpqcShowForm] = useState(false)
  const [ipqcShowDetail, setIpqcShowDetail] = useState<any>(null)
  const [ipqcForm, setIpqcForm] = useState<any>({
    productDesignId: '', oemContractId: '', batchNo: '', stage: 'PRODUCTION',
    checkDate: new Date().toISOString().slice(0, 10), inspector: '',
    items: '', result: 'PENDING', imageUrls: '', remark: '',
  })
  // IPQC 检验项目动态列表
  const [ipqcCheckItems, setIpqcCheckItems] = useState<{ name: string; standard: string; result: string; remark: string }[]>([])

  // ── OQC 状态 ──
  const [oqcItems, setOqcItems] = useState<any[]>([])
  const [oqcSearch, setOqcSearch] = useState('')
  const [oqcResultFilter, setOqcResultFilter] = useState('')
  const [oqcLoading, setOqcLoading] = useState(true)
  const [oqcShowForm, setOqcShowForm] = useState(false)
  const [oqcShowDetail, setOqcShowDetail] = useState<any>(null)
  const [oqcForm, setOqcForm] = useState<any>({
    productDesignId: '', batchNo: '', quantityTotal: '', quantitySampled: '',
    checkDate: new Date().toISOString().slice(0, 10), inspector: '',
    result: 'PENDING', items: '', disposition: '', reportUrl: '', remark: '',
  })
  const [oqcCheckItems, setOqcCheckItems] = useState<{ name: string; standard: string; result: string; remark: string }[]>([])

  // ── 初始加载 ──
  useEffect(() => {
    fetchProducts()
    fetchOemContracts()
    fetchMaterials()
  }, [])

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await apiFetch('/api/rnd/materials?q=')
      const data = await res.json()
      if (res.ok) setMaterials(data.data || data.rawMaterials || [])
    } catch {}
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/rnd/products')
      const data = await res.json()
      if (res.ok) setProducts(data.data || data.products || [])
    } catch {}
  }, [])

  const fetchOemContracts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/supply/oem')
      const data = await res.json()
      if (res.ok) setOemContracts(data.data || data.items || [])
    } catch {}
  }, [])

  // ── IQC 数据 ──
  const fetchIqc = useCallback(async () => {
    setIqcLoading(true)
    const params = new URLSearchParams()
    if (iqcSearch) params.set('q', iqcSearch)
    if (iqcResultFilter) params.set('result', iqcResultFilter)
    try {
      const res = await apiFetch(`/api/supply/incoming-inspection?${params}`)
      const data = await res.json()
      if (res.ok) setIqcItems(data.data || data.items || [])
    } catch {}
    setIqcLoading(false)
  }, [iqcSearch, iqcResultFilter])

  useEffect(() => { if (activeTab === 'iqc') fetchIqc() }, [activeTab, fetchIqc])

  // ── IPQC 数据 ──
  const fetchIpqc = useCallback(async () => {
    setIpqcLoading(true)
    const params = new URLSearchParams()
    if (ipqcSearch) params.set('q', ipqcSearch)
    if (ipqcResultFilter) params.set('result', ipqcResultFilter)
    if (ipqcStageFilter) params.set('stage', ipqcStageFilter)
    try {
      const res = await apiFetch(`/api/supply/ipqc?${params}`)
      const data = await res.json()
      if (res.ok) setIpqcItems(data.data || data.items || [])
    } catch {}
    setIpqcLoading(false)
  }, [ipqcSearch, ipqcResultFilter, ipqcStageFilter])

  useEffect(() => { if (activeTab === 'ipqc') fetchIpqc() }, [activeTab, fetchIpqc])

  // ── OQC 数据 ──
  const fetchOqc = useCallback(async () => {
    setOqcLoading(true)
    const params = new URLSearchParams()
    if (oqcSearch) params.set('q', oqcSearch)
    if (oqcResultFilter) params.set('result', oqcResultFilter)
    try {
      const res = await apiFetch(`/api/supply/oqc?${params}`)
      const data = await res.json()
      if (res.ok) setOqcItems(data.data || data.items || [])
    } catch {}
    setOqcLoading(false)
  }, [oqcSearch, oqcResultFilter])

  useEffect(() => { if (activeTab === 'oqc') fetchOqc() }, [activeTab, fetchOqc])

  // ── IQC：选择原料后加载批次 ──
  const handleMaterialChange = async (materialId: string) => {
    setIqcForm({ ...iqcForm, rawMaterialId: materialId, batchId: '' })
    if (materialId) {
      try {
        const res = await apiFetch(`/api/supply/inventory?materialId=${materialId}`)
        const data = await res.json()
        setBatches(data.data || data.items || [])
      } catch { setBatches([]) }
    } else { setBatches([]) }
  }

  // ── IQC：创建 ──
  const handleIqcCreate = async () => {
    const body = {
      rawMaterialId: iqcForm.rawMaterialId,
      batchId: iqcForm.batchId || null,
      supplierBatchNo: iqcForm.supplierBatchNo,
      quantityReceived: parseFloat(iqcForm.quantityReceived) || 0,
      unit: iqcForm.unit,
      receiptDate: iqcForm.receiptDate,
      coaVerified: iqcForm.coaVerified,
      coaResult: iqcForm.coaResult || null,
      sampleQty: iqcForm.sampleQty || null,
      sampleLocation: iqcForm.sampleLocation || null,
      samplePerson: iqcForm.samplePerson || null,
      inspectionDate: iqcForm.inspectionDate || null,
      inspector: iqcForm.inspector || null,
      result: iqcForm.result,
      nonConformity: iqcForm.nonConformity ? [{ item: iqcForm.nonConformity }] : null,
      disposition: iqcForm.disposition || null,
      remark: iqcForm.remark || null,
    }
    try {
      await apiFetch('/api/supply/incoming-inspection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      setIqcShowForm(false)
      resetIqcForm()
      fetchIqc()
    } catch {}
  }

  // ── IQC：更新 ──
  const handleIqcUpdate = async () => {
    if (!iqcShowDetail) return
    try {
      await apiFetch(`/api/supply/incoming-inspection/${iqcShowDetail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          result: iqcShowDetail.result, disposition: iqcShowDetail.disposition,
          nonConformity: iqcShowDetail.nonConformity, sampleQty: iqcShowDetail.sampleQty,
          sampleLocation: iqcShowDetail.sampleLocation, samplePerson: iqcShowDetail.samplePerson,
          inspectionDate: iqcShowDetail.inspectionDate, inspector: iqcShowDetail.inspector,
          coaVerified: iqcShowDetail.coaVerified, coaResult: iqcShowDetail.coaResult,
          remark: iqcShowDetail.remark,
        }),
      })
      setIqcShowDetail(null)
      fetchIqc()
    } catch {}
  }

  const resetIqcForm = () => {
    setIqcForm({
      rawMaterialId: '', batchId: '', supplierBatchNo: '', quantityReceived: '',
      unit: 'kg', receiptDate: new Date().toISOString().slice(0, 10),
      coaVerified: false, coaResult: '', sampleQty: '', sampleLocation: '',
      samplePerson: '', inspectionDate: '', inspector: '', result: 'PENDING',
      nonConformity: '', disposition: '', remark: '',
    })
  }

  // ── IPQC：创建 ──
  const handleIpqcCreate = async () => {
    const body = {
      productDesignId: ipqcForm.productDesignId,
      oemContractId: ipqcForm.oemContractId || null,
      batchNo: ipqcForm.batchNo,
      stage: ipqcForm.stage,
      checkDate: ipqcForm.checkDate || null,
      inspector: ipqcForm.inspector || null,
      items: ipqcCheckItems.length > 0 ? ipqcCheckItems : null,
      result: ipqcForm.result,
      imageUrls: ipqcForm.imageUrls ? [{ url: ipqcForm.imageUrls }] : null,
      remark: ipqcForm.remark || null,
    }
    try {
      await apiFetch('/api/supply/ipqc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      setIpqcShowForm(false)
      resetIpqcForm()
      fetchIpqc()
    } catch {}
  }

  // ── IPQC：更新 ──
  const handleIpqcUpdate = async () => {
    if (!ipqcShowDetail) return
    try {
      await apiFetch(`/api/supply/ipqc/${ipqcShowDetail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          result: ipqcShowDetail.result, stage: ipqcShowDetail.stage,
          inspector: ipqcShowDetail.inspector, checkDate: ipqcShowDetail.checkDate,
          items: ipqcShowDetail.items, imageUrls: ipqcShowDetail.imageUrls,
          remark: ipqcShowDetail.remark,
        }),
      })
      setIpqcShowDetail(null)
      fetchIpqc()
    } catch {}
  }

  const resetIpqcForm = () => {
    setIpqcForm({
      productDesignId: '', oemContractId: '', batchNo: '', stage: 'PRODUCTION',
      checkDate: new Date().toISOString().slice(0, 10), inspector: '',
      items: '', result: 'PENDING', imageUrls: '', remark: '',
    })
    setIpqcCheckItems([])
  }

  // ── IPQC：添加检验项目行 ──
  const addIpqcCheckItem = () => {
    setIpqcCheckItems([...ipqcCheckItems, { name: '', standard: '', result: '', remark: '' }])
  }
  const updateIpqcCheckItem = (idx: number, field: string, value: string) => {
    const next = [...ipqcCheckItems]
    next[idx] = { ...next[idx], [field]: value }
    setIpqcCheckItems(next)
  }
  const removeIpqcCheckItem = (idx: number) => {
    setIpqcCheckItems(ipqcCheckItems.filter((_, i) => i !== idx))
  }

  // ── OQC：创建 ──
  const handleOqcCreate = async () => {
    const body = {
      productDesignId: oqcForm.productDesignId,
      batchNo: oqcForm.batchNo,
      quantityTotal: oqcForm.quantityTotal || 0,
      quantitySampled: oqcForm.quantitySampled || 0,
      checkDate: oqcForm.checkDate || null,
      inspector: oqcForm.inspector || null,
      result: oqcForm.result,
      items: oqcCheckItems.length > 0 ? oqcCheckItems : null,
      disposition: oqcForm.disposition || null,
      reportUrl: oqcForm.reportUrl || null,
      remark: oqcForm.remark || null,
    }
    try {
      await apiFetch('/api/supply/oqc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      setOqcShowForm(false)
      resetOqcForm()
      fetchOqc()
    } catch {}
  }

  // ── OQC：更新 ──
  const handleOqcUpdate = async () => {
    if (!oqcShowDetail) return
    try {
      await apiFetch(`/api/supply/oqc/${oqcShowDetail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          result: oqcShowDetail.result, disposition: oqcShowDetail.disposition,
          inspector: oqcShowDetail.inspector, checkDate: oqcShowDetail.checkDate,
          items: oqcShowDetail.items, reportUrl: oqcShowDetail.reportUrl,
          quantityTotal: oqcShowDetail.quantityTotal, quantitySampled: oqcShowDetail.quantitySampled,
          remark: oqcShowDetail.remark,
        }),
      })
      setOqcShowDetail(null)
      fetchOqc()
    } catch {}
  }

  const resetOqcForm = () => {
    setOqcForm({
      productDesignId: '', batchNo: '', quantityTotal: '', quantitySampled: '',
      checkDate: new Date().toISOString().slice(0, 10), inspector: '',
      result: 'PENDING', items: '', disposition: '', reportUrl: '', remark: '',
    })
    setOqcCheckItems([])
  }

  // ── OQC：添加检验项目行 ──
  const addOqcCheckItem = () => {
    setOqcCheckItems([...oqcCheckItems, { name: '', standard: '', result: '', remark: '' }])
  }
  const updateOqcCheckItem = (idx: number, field: string, value: string) => {
    const next = [...oqcCheckItems]
    next[idx] = { ...next[idx], [field]: value }
    setOqcCheckItems(next)
  }
  const removeOqcCheckItem = (idx: number) => {
    setOqcCheckItems(oqcCheckItems.filter((_, i) => i !== idx))
  }

  // ── IPQC删除 ──
  const handleIpqcDelete = async (id: string) => {
    if (!confirm('确认删除此制程检验记录？')) return
    try {
      await apiFetch(`/api/supply/ipqc/${id}`, { method: 'DELETE' })
      fetchIpqc()
    } catch {}
  }

  // ── OQC删除 ──
  const handleOqcDelete = async (id: string) => {
    if (!confirm('确认删除此出厂检验记录？')) return
    try {
      await apiFetch(`/api/supply/oqc/${id}`, { method: 'DELETE' })
      fetchOqc()
    } catch {}
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'iqc', label: '来料检验(IQC)' },
    { key: 'ipqc', label: '制程检验(IPQC)' },
    { key: 'oqc', label: '出厂检验(OQC)' },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
              <h1 className="text-xl font-bold text-[var(--color-text)]">质量管理</h1>
              <span className="text-xs text-[var(--color-text-secondary)]">IQC / IPQC / OQC</span>
            </div>
            {activeTab === 'ipqc' && (
              <button onClick={() => setIpqcShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">+ 新建制程检验</button>
            )}
            {activeTab === 'oqc' && (
              <button onClick={() => setOqcShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">+ 新建出厂检验</button>
            )}
            {activeTab === 'iqc' && (
              <button onClick={() => setIqcShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">+ 新建来料质检</button>
            )}
          </div>
          {/* Tab 切换 */}
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">

        {/* ════════ IQC TAB ════════ */}
        {activeTab === 'iqc' && (
          <>
            <div className="mb-4 flex gap-3">
              <input type="text" placeholder="搜索原料名 / 供应商批次..." value={iqcSearch}
                onChange={e => setIqcSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
              <select value={iqcResultFilter} onChange={e => setIqcResultFilter(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm">
                <option value="">全部状态</option>
                <option value="PENDING">待检</option>
                <option value="PASS">通过</option>
                <option value="CONDITIONAL">让步接收</option>
                <option value="FAIL">不合格</option>
              </select>
            </div>

            {/* IQC 新建弹窗 */}
            {iqcShowForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIqcShowForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">新建来料质检</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2 border-b pb-3 mb-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">基本信息</span></div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">原料 *</label>
                      <select value={iqcForm.rawMaterialId} onChange={e => handleMaterialChange(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择原料</option>
                        {materials.map((m: any) => <option key={m.id} value={m.id}>{m.nameCn}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">关联批次</label>
                      <select value={iqcForm.batchId} onChange={e => setIqcForm({...iqcForm, batchId: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">不关联</option>
                        {batches.map((b: any) => <option key={b.id} value={b.id}>{b.batchNo} ({b.internalBatch})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">供应商批次号 *</label>
                      <input type="text" value={iqcForm.supplierBatchNo} onChange={e => setIqcForm({...iqcForm, supplierBatchNo: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">到货数量</label>
                      <div className="flex gap-1">
                        <input type="number" value={iqcForm.quantityReceived} onChange={e => setIqcForm({...iqcForm, quantityReceived: e.target.value})}
                          className="flex-1 px-3 py-1.5 border rounded text-sm" />
                        <select value={iqcForm.unit} onChange={e => setIqcForm({...iqcForm, unit: e.target.value})}
                          className="w-20 px-2 py-1.5 border rounded text-sm">
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="mL">mL</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">到货日期</label>
                      <input type="date" value={iqcForm.receiptDate} onChange={e => setIqcForm({...iqcForm, receiptDate: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2 border-b pb-3 mb-1 mt-2"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">COA 核对</span></div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={iqcForm.coaVerified} onChange={e => setIqcForm({...iqcForm, coaVerified: e.target.checked})}
                          className="rounded border-[var(--color-border)]" />
                        <span className="text-[var(--color-text)]">COA 已核对</span>
                      </label>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">COA 结果</label>
                      <input type="text" value={iqcForm.coaResult} onChange={e => setIqcForm({...iqcForm, coaResult: e.target.value})}
                        placeholder="COA 符合性说明" className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2 border-b pb-3 mb-1 mt-2"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">留样登记</span></div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">留样数量</label>
                      <input type="number" value={iqcForm.sampleQty} onChange={e => setIqcForm({...iqcForm, sampleQty: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">留样位置</label>
                      <input type="text" value={iqcForm.sampleLocation} onChange={e => setIqcForm({...iqcForm, sampleLocation: e.target.value})}
                        placeholder="如：A区-3号架" className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">留样人</label>
                      <input type="text" value={iqcForm.samplePerson} onChange={e => setIqcForm({...iqcForm, samplePerson: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2 border-b pb-3 mb-1 mt-2"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验记录</span></div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                      <input type="date" value={iqcForm.inspectionDate} onChange={e => setIqcForm({...iqcForm, inspectionDate: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                      <input type="text" value={iqcForm.inspector} onChange={e => setIqcForm({...iqcForm, inspector: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2 border-b pb-3 mb-1 mt-2"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">判定结果</span></div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验结果 *</label>
                      <select value={iqcForm.result} onChange={e => setIqcForm({...iqcForm, result: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PENDING">待检</option>
                        <option value="PASS">通过</option>
                        <option value="CONDITIONAL">让步接收</option>
                        <option value="FAIL">不合格</option>
                      </select>
                    </div>
                    {(iqcForm.result === 'FAIL' || iqcForm.result === 'CONDITIONAL') && (
                      <>
                        <div>
                          <label className="block text-[var(--color-text-secondary)] mb-1">处置方式</label>
                          <select value={iqcForm.disposition} onChange={e => setIqcForm({...iqcForm, disposition: e.target.value})}
                            className="w-full px-3 py-1.5 border rounded text-sm">
                            <option value="">选择处置</option>
                            <option value="USE_AS_IS">让步使用</option>
                            <option value="RETURN">退回</option>
                            <option value="SCRAP">报废</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[var(--color-text-secondary)] mb-1">不合格项记录</label>
                          <textarea value={iqcForm.nonConformity} onChange={e => setIqcForm({...iqcForm, nonConformity: e.target.value})}
                            placeholder="描述不合格的具体项目..." className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                        </div>
                      </>
                    )}
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={iqcForm.remark} onChange={e => setIqcForm({...iqcForm, remark: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => { setIqcShowForm(false); resetIqcForm() }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleIqcCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                      disabled={!iqcForm.rawMaterialId || !iqcForm.supplierBatchNo}>创建</button>
                  </div>
                </div>
              </div>
            )}

            {/* IQC 详情弹窗 */}
            {iqcShowDetail && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIqcShowDetail(null)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">来料质检详情</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-secondary)]">原料：</span>
                      <span className="font-medium">{iqcShowDetail.rawMaterial?.nameCn || '-'}</span>
                    </div>
                    <div><span className="text-[var(--color-text-secondary)]">供应商批次：</span><span className="font-mono text-xs">{iqcShowDetail.supplierBatchNo}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">内部批次：</span><span className="font-mono text-xs">{iqcShowDetail.batch?.internalBatch || '-'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">到货数量：</span><span>{iqcShowDetail.quantityReceived}{iqcShowDetail.unit}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">到货日期：</span><span>{new Date(iqcShowDetail.receiptDate).toLocaleDateString('zh-CN')}</span></div>
                    <div className="col-span-2 border-t pt-3 mt-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">COA 核对</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">COA 核对：</span><span className={iqcShowDetail.coaVerified ? 'text-green-600' : 'text-yellow-600'}>{iqcShowDetail.coaVerified ? '✓ 已核对' : '○ 未核对'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">COA 结果：</span><span>{iqcShowDetail.coaResult || '-'}</span></div>
                    <div className="col-span-2 border-t pt-3 mt-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">留样登记</span></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">留样数量</label><input type="number" value={iqcShowDetail.sampleQty || ''} onChange={e => setIqcShowDetail({...iqcShowDetail, sampleQty: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">留样位置</label><input type="text" value={iqcShowDetail.sampleLocation || ''} onChange={e => setIqcShowDetail({...iqcShowDetail, sampleLocation: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">留样人</label><input type="text" value={iqcShowDetail.samplePerson || ''} onChange={e => setIqcShowDetail({...iqcShowDetail, samplePerson: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div className="col-span-2 border-t pt-3 mt-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验记录</span></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label><input type="date" value={iqcShowDetail.inspectionDate ? iqcShowDetail.inspectionDate.slice(0, 10) : ''} onChange={e => setIqcShowDetail({...iqcShowDetail, inspectionDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">检验人</label><input type="text" value={iqcShowDetail.inspector || ''} onChange={e => setIqcShowDetail({...iqcShowDetail, inspector: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div className="col-span-2 border-t pt-3 mt-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">判定结果</span></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">检验结果</label>
                      <select value={iqcShowDetail.result} onChange={e => setIqcShowDetail({...iqcShowDetail, result: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PENDING">待检</option><option value="PASS">通过</option><option value="CONDITIONAL">让步接收</option><option value="FAIL">不合格</option>
                      </select>
                    </div>
                    {(iqcShowDetail.result === 'FAIL' || iqcShowDetail.result === 'CONDITIONAL') && (
                      <>
                        <div><label className="block text-[var(--color-text-secondary)] mb-1">处置方式</label>
                          <select value={iqcShowDetail.disposition || ''} onChange={e => setIqcShowDetail({...iqcShowDetail, disposition: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                            <option value="">选择处置</option><option value="USE_AS_IS">让步使用</option><option value="RETURN">退回</option><option value="SCRAP">报废</option>
                          </select>
                        </div>
                        <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">不合格项</label>
                          <textarea value={Array.isArray(iqcShowDetail.nonConformity) ? iqcShowDetail.nonConformity.map((n: any) => n.item || '').join('\n') : ''}
                            onChange={e => setIqcShowDetail({...iqcShowDetail, nonConformity: e.target.value.split('\n').filter(Boolean).map((item: string) => ({ item }))})}
                            className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                        </div>
                      </>
                    )}
                    <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={iqcShowDetail.remark || ''} onChange={e => setIqcShowDetail({...iqcShowDetail, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setIqcShowDetail(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleIqcUpdate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">保存</button>
                  </div>
                </div>
              </div>
            )}

            {/* IQC 列表 */}
            {iqcLoading ? (
              <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
            ) : iqcItems.length === 0 ? (
              <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div className="empty-state-title">暂无来料质检记录</div><div className="empty-state-desc">点击上方"新建来料质检"开始</div></div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="bg-[var(--color-bg)] border-b">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">原料</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">供应商批次</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">到货量</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">到货日</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">COA</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">结果</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">处置</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {iqcItems.map(i => (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={i.rawMaterial?.nameCn || '-'}>{i.rawMaterial?.nameCn || '-'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{i.supplierBatchNo}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{i.quantityReceived}{i.unit}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{new Date(i.receiptDate).toLocaleDateString('zh-CN')}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><span className={`inline-block w-2 h-2 rounded-full ${i.coaVerified ? 'bg-green-500' : 'bg-yellow-400'}`} title={i.coaVerified ? '已核对' : '未核对'} /></td>
                        <td className="px-4 py-3 text-center whitespace-nowrap"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[i.result] || ''}`}>{RESULT_LABELS[i.result] || i.result}</span></td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{i.disposition ? (DISPOSITION_LABELS_IQC[i.disposition] || i.disposition) : '-'}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap"><button onClick={() => setIqcShowDetail(i)} className="text-emerald-600 hover:text-emerald-800 text-xs">编辑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════════ IPQC TAB ════════ */}
        {activeTab === 'ipqc' && (
          <>
            <div className="mb-4 flex gap-3">
              <input type="text" placeholder="搜索产品名 / 批次号..." value={ipqcSearch}
                onChange={e => setIpqcSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
              <select value={ipqcResultFilter} onChange={e => setIpqcResultFilter(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm">
                <option value="">全部结果</option>
                <option value="PENDING">待检</option>
                <option value="PASS">通过</option>
                <option value="CONDITIONAL">让步</option>
                <option value="FAIL">不合格</option>
              </select>
              <select value={ipqcStageFilter} onChange={e => setIpqcStageFilter(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm">
                <option value="">全部工序</option>
                <option value="PRODUCTION">生产</option>
                <option value="FILLING">灌装</option>
                <option value="PACKAGING">包装</option>
                <option value="LABELING">标签</option>
              </select>
            </div>

            {/* IPQC 新建弹窗 */}
            {ipqcShowForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIpqcShowForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">新建制程检验</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2 border-b pb-3 mb-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">基本信息</span></div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">关联产品 *</label>
                      <select value={ipqcForm.productDesignId} onChange={e => setIpqcForm({...ipqcForm, productDesignId: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择产品</option>
                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">代工合同（可选）</label>
                      <select value={ipqcForm.oemContractId} onChange={e => setIpqcForm({...ipqcForm, oemContractId: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">不关联</option>
                        {oemContracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNo} - {c.productName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">批次号 *</label>
                      <input type="text" value={ipqcForm.batchNo} onChange={e => setIpqcForm({...ipqcForm, batchNo: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">生产工序</label>
                      <select value={ipqcForm.stage} onChange={e => setIpqcForm({...ipqcForm, stage: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PRODUCTION">生产</option>
                        <option value="FILLING">灌装</option>
                        <option value="PACKAGING">包装</option>
                        <option value="LABELING">标签</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                      <input type="date" value={ipqcForm.checkDate} onChange={e => setIpqcForm({...ipqcForm, checkDate: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                      <input type="text" value={ipqcForm.inspector} onChange={e => setIpqcForm({...ipqcForm, inspector: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>

                    {/* 检验项目动态列表 */}
                    <div className="col-span-2 border-b pb-3 mb-1 mt-2">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验项目</span>
                    </div>
                    {ipqcCheckItems.map((item, idx) => (
                      <div key={idx} className="col-span-2 border rounded p-3 bg-[var(--color-bg)]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium">项目 {idx + 1}</span>
                          <button onClick={() => removeIpqcCheckItem(idx)} className="text-red-500 text-xs">删除</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">项目名称</label>
                            <input type="text" value={item.name} onChange={e => updateIpqcCheckItem(idx, 'name', e.target.value)}
                              placeholder="如：外观" className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">标准要求</label>
                            <input type="text" value={item.standard} onChange={e => updateIpqcCheckItem(idx, 'standard', e.target.value)}
                              placeholder="如：无异物" className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">检验结果</label>
                            <input type="text" value={item.result} onChange={e => updateIpqcCheckItem(idx, 'result', e.target.value)}
                              placeholder="合格/不合格" className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">备注</label>
                            <input type="text" value={item.remark} onChange={e => updateIpqcCheckItem(idx, 'remark', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-xs" /></div>
                        </div>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <button onClick={addIpqcCheckItem} className="text-emerald-600 text-xs hover:underline">+ 添加检验项目</button>
                    </div>

                    <div className="col-span-2 border-b pb-3 mb-1 mt-2"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">判定结果</span></div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验结果</label>
                      <select value={ipqcForm.result} onChange={e => setIpqcForm({...ipqcForm, result: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PENDING">待检</option>
                        <option value="PASS">通过</option>
                        <option value="CONDITIONAL">让步</option>
                        <option value="FAIL">不合格</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">现场照片URL</label>
                      <input type="text" value={ipqcForm.imageUrls} onChange={e => setIpqcForm({...ipqcForm, imageUrls: e.target.value})}
                        placeholder="可选，逗号分隔" className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={ipqcForm.remark} onChange={e => setIpqcForm({...ipqcForm, remark: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => { setIpqcShowForm(false); resetIpqcForm() }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleIpqcCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                      disabled={!ipqcForm.productDesignId || !ipqcForm.batchNo}>创建</button>
                  </div>
                </div>
              </div>
            )}

            {/* IPQC 详情弹窗 */}
            {ipqcShowDetail && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIpqcShowDetail(null)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">制程检验详情</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-secondary)]">产品：</span>
                      <span className="font-medium">{ipqcShowDetail.product?.name || '-'}</span>
                    </div>
                    <div><span className="text-[var(--color-text-secondary)]">批次号：</span><span className="font-mono text-xs">{ipqcShowDetail.batchNo}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">工序：</span><span>{IPQC_STAGE_LABELS[ipqcShowDetail.stage] || ipqcShowDetail.stage}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">检验日期：</span><span>{ipqcShowDetail.checkDate ? new Date(ipqcShowDetail.checkDate).toLocaleDateString('zh-CN') : '-'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">检验人：</span><span>{ipqcShowDetail.inspector || '-'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">代工合同：</span><span>{ipqcShowDetail.oemContract ? `${ipqcShowDetail.oemContract.contractNo} - ${ipqcShowDetail.oemContract.productName}` : '-'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">结果：</span><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[ipqcShowDetail.result] || ''}`}>{RESULT_LABELS[ipqcShowDetail.result] || ipqcShowDetail.result}</span></div>

                    {ipqcShowDetail.items && Array.isArray(ipqcShowDetail.items) && ipqcShowDetail.items.length > 0 && (
                      <div className="col-span-2 border-t pt-3 mt-1">
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验项目</span>
                        <div className="mt-2 space-y-2">
                          {ipqcShowDetail.items.map((item: any, idx: number) => (
                            <div key={idx} className="border rounded p-2 text-xs grid grid-cols-4 gap-2">
                              <div><span className="text-[var(--color-text-secondary)]">项目：</span>{item.name || '-'}</div>
                              <div><span className="text-[var(--color-text-secondary)]">标准：</span>{item.standard || '-'}</div>
                              <div><span className="text-[var(--color-text-secondary)]">结果：</span>{item.result || '-'}</div>
                              <div><span className="text-[var(--color-text-secondary)]">备注：</span>{item.remark || '-'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ipqcShowDetail.imageUrls && Array.isArray(ipqcShowDetail.imageUrls) && ipqcShowDetail.imageUrls.length > 0 && (
                      <div className="col-span-2 border-t pt-3 mt-1">
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">现场照片</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ipqcShowDetail.imageUrls.map((img: any, idx: number) => (
                            <a key={idx} href={img.url || img} target="_blank" rel="noreferrer" className="text-emerald-600 text-xs hover:underline">{img.url || img}</a>
                          ))}
                        </div>
                      </div>
                    )}

                    {ipqcShowDetail.remark && (
                      <div className="col-span-2 border-t pt-3 mt-1">
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">备注</span>
                        <p className="mt-1 text-sm">{ipqcShowDetail.remark}</p>
                      </div>
                    )}

                    {/* 编辑区域 */}
                    <div className="col-span-2 border-t pt-3 mt-1">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">编辑</span>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">工序</label>
                      <select value={ipqcShowDetail.stage} onChange={e => setIpqcShowDetail({...ipqcShowDetail, stage: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PRODUCTION">生产</option>
                        <option value="FILLING">灌装</option>
                        <option value="PACKAGING">包装</option>
                        <option value="LABELING">标签</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验结果</label>
                      <select value={ipqcShowDetail.result} onChange={e => setIpqcShowDetail({...ipqcShowDetail, result: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PENDING">待检</option>
                        <option value="PASS">通过</option>
                        <option value="CONDITIONAL">让步</option>
                        <option value="FAIL">不合格</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                      <input type="date" value={ipqcShowDetail.checkDate ? ipqcShowDetail.checkDate.slice(0, 10) : ''}
                        onChange={e => setIpqcShowDetail({...ipqcShowDetail, checkDate: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                      <input type="text" value={ipqcShowDetail.inspector || ''}
                        onChange={e => setIpqcShowDetail({...ipqcShowDetail, inspector: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={ipqcShowDetail.remark || ''}
                        onChange={e => setIpqcShowDetail({...ipqcShowDetail, remark: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setIpqcShowDetail(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={() => { handleIpqcDelete(ipqcShowDetail.id); setIpqcShowDetail(null) }} className="px-4 py-2 text-red-600 text-sm">删除</button>
                    <button onClick={handleIpqcUpdate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">保存</button>
                  </div>
                </div>
              </div>
            )}

            {/* IPQC 列表 */}
            {ipqcLoading ? (
              <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
            ) : ipqcItems.length === 0 ? (
              <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div className="empty-state-title">暂无制程检验记录</div><div className="empty-state-desc">点击上方"新建制程检验"开始</div></div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="bg-[var(--color-bg)] border-b">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">产品</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">批次号</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">工序</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">检验人</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">检验日</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">结果</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipqcItems.map(i => (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={i.product?.name || '-'}>{i.product?.name || '-'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{i.batchNo}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">{IPQC_STAGE_LABELS[i.stage] || i.stage}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">{i.inspector || '-'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{i.checkDate ? new Date(i.checkDate).toLocaleDateString('zh-CN') : '-'}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[i.result] || ''}`}>{RESULT_LABELS[i.result] || i.result}</span></td>
                        <td className="px-4 py-3 text-center whitespace-nowrap"><button onClick={() => setIpqcShowDetail(i)} className="text-emerald-600 hover:text-emerald-800 text-xs">编辑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════════ OQC TAB ════════ */}
        {activeTab === 'oqc' && (
          <>
            <div className="mb-4 flex gap-3">
              <input type="text" placeholder="搜索产品名 / 批次号..." value={oqcSearch}
                onChange={e => setOqcSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
              <select value={oqcResultFilter} onChange={e => setOqcResultFilter(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm">
                <option value="">全部结果</option>
                <option value="PENDING">待检</option>
                <option value="PASS">通过</option>
                <option value="CONDITIONAL">让步</option>
                <option value="FAIL">不合格</option>
              </select>
            </div>

            {/* OQC 新建弹窗 */}
            {oqcShowForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setOqcShowForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">新建出厂检验</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2 border-b pb-3 mb-1"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">基本信息</span></div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">关联产品 *</label>
                      <select value={oqcForm.productDesignId} onChange={e => setOqcForm({...oqcForm, productDesignId: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择产品</option>
                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">批次号 *</label>
                      <input type="text" value={oqcForm.batchNo} onChange={e => setOqcForm({...oqcForm, batchNo: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                      <input type="date" value={oqcForm.checkDate} onChange={e => setOqcForm({...oqcForm, checkDate: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">总数量</label>
                      <input type="number" value={oqcForm.quantityTotal} onChange={e => setOqcForm({...oqcForm, quantityTotal: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">抽样数量</label>
                      <input type="number" value={oqcForm.quantitySampled} onChange={e => setOqcForm({...oqcForm, quantitySampled: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                      <input type="text" value={oqcForm.inspector} onChange={e => setOqcForm({...oqcForm, inspector: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>

                    {/* 检验项目动态列表 */}
                    <div className="col-span-2 border-b pb-3 mb-1 mt-2">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验项目</span>
                    </div>
                    {oqcCheckItems.map((item, idx) => (
                      <div key={idx} className="col-span-2 border rounded p-3 bg-[var(--color-bg)]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium">项目 {idx + 1}</span>
                          <button onClick={() => removeOqcCheckItem(idx)} className="text-red-500 text-xs">删除</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">项目名称</label>
                            <input type="text" value={item.name} onChange={e => updateOqcCheckItem(idx, 'name', e.target.value)}
                              placeholder="如：外观" className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">标准要求</label>
                            <input type="text" value={item.standard} onChange={e => updateOqcCheckItem(idx, 'standard', e.target.value)}
                              placeholder="如：无漏液" className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">检验结果</label>
                            <input type="text" value={item.result} onChange={e => updateOqcCheckItem(idx, 'result', e.target.value)}
                              placeholder="合格/不合格" className="w-full px-2 py-1 border rounded text-xs" /></div>
                          <div><label className="block text-[var(--color-text-secondary)] mb-1 text-xs">备注</label>
                            <input type="text" value={item.remark} onChange={e => updateOqcCheckItem(idx, 'remark', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-xs" /></div>
                        </div>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <button onClick={addOqcCheckItem} className="text-emerald-600 text-xs hover:underline">+ 添加检验项目</button>
                    </div>

                    <div className="col-span-2 border-b pb-3 mb-1 mt-2"><span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">判定结果</span></div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验结果</label>
                      <select value={oqcForm.result} onChange={e => setOqcForm({...oqcForm, result: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PENDING">待检</option>
                        <option value="PASS">通过</option>
                        <option value="CONDITIONAL">让步</option>
                        <option value="FAIL">不合格</option>
                      </select>
                    </div>
                    {oqcForm.result !== 'PENDING' && (
                      <div>
                        <label className="block text-[var(--color-text-secondary)] mb-1">处置方式</label>
                        <select value={oqcForm.disposition} onChange={e => setOqcForm({...oqcForm, disposition: e.target.value})}
                          className="w-full px-3 py-1.5 border rounded text-sm">
                          <option value="">选择处置</option>
                          <option value="PASS">放行</option>
                          <option value="REWORK">返工</option>
                          <option value="SCRAP">报废</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验报告</label>
                      <div className="flex items-center gap-2">
                        <input type="file" id="oqcReportUpload" accept=".pdf,.doc,.docx,image/*" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const fd = new FormData()
                            fd.append('file', file)
                            const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
                            const data = await res.json()
                            if (data.url) setOqcForm({...oqcForm, reportUrl: data.url})
                          }}
                        />
                        <button type="button" onClick={() => document.getElementById('oqcReportUpload')?.click()}
                          className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">选择文件上传</button>
                        {oqcForm.reportUrl ? (
                          <><span className="text-xs text-green-600">✓ 已上传</span>
                            <button onClick={() => setOqcForm({...oqcForm, reportUrl: ''})} className="text-red-500 text-xs ml-1">移除</button>
                            <a href={oqcForm.reportUrl} target="_blank" className="text-blue-500 text-xs ml-2 hover:underline">查看</a></>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={oqcForm.remark} onChange={e => setOqcForm({...oqcForm, remark: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => { setOqcShowForm(false); resetOqcForm() }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleOqcCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                      disabled={!oqcForm.productDesignId || !oqcForm.batchNo}>创建</button>
                  </div>
                </div>
              </div>
            )}

            {/* OQC 详情弹窗 */}
            {oqcShowDetail && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setOqcShowDetail(null)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">出厂检验详情</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-secondary)]">产品：</span>
                      <span className="font-medium">{oqcShowDetail.product?.name || '-'}</span>
                    </div>
                    <div><span className="text-[var(--color-text-secondary)]">批次号：</span><span className="font-mono text-xs">{oqcShowDetail.batchNo}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">检验日期：</span><span>{oqcShowDetail.checkDate ? new Date(oqcShowDetail.checkDate).toLocaleDateString('zh-CN') : '-'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">检验人：</span><span>{oqcShowDetail.inspector || '-'}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">总数量：</span><span>{oqcShowDetail.quantityTotal}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">抽样数量：</span><span>{oqcShowDetail.quantitySampled}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">结果：</span><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[oqcShowDetail.result] || ''}`}>{RESULT_LABELS[oqcShowDetail.result] || oqcShowDetail.result}</span></div>
                    <div><span className="text-[var(--color-text-secondary)]">处置：</span><span>{oqcShowDetail.disposition ? (OQC_DISPOSITION_LABELS[oqcShowDetail.disposition] || oqcShowDetail.disposition) : '-'}</span></div>

                    {oqcShowDetail.reportUrl && (
                      <div className="col-span-2 border-t pt-3 mt-1">
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验报告</span>
                        <div className="mt-1"><a href={oqcShowDetail.reportUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm hover:underline">查看报告</a></div>
                      </div>
                    )}

                    {oqcShowDetail.items && Array.isArray(oqcShowDetail.items) && oqcShowDetail.items.length > 0 && (
                      <div className="col-span-2 border-t pt-3 mt-1">
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验项目</span>
                        <div className="mt-2 space-y-2">
                          {oqcShowDetail.items.map((item: any, idx: number) => (
                            <div key={idx} className="border rounded p-2 text-xs grid grid-cols-4 gap-2">
                              <div><span className="text-[var(--color-text-secondary)]">项目：</span>{item.name || '-'}</div>
                              <div><span className="text-[var(--color-text-secondary)]">标准：</span>{item.standard || '-'}</div>
                              <div><span className="text-[var(--color-text-secondary)]">结果：</span>{item.result || '-'}</div>
                              <div><span className="text-[var(--color-text-secondary)]">备注：</span>{item.remark || '-'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 编辑区域 */}
                    <div className="col-span-2 border-t pt-3 mt-1">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">编辑</span>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验结果</label>
                      <select value={oqcShowDetail.result} onChange={e => setOqcShowDetail({...oqcShowDetail, result: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="PENDING">待检</option>
                        <option value="PASS">通过</option>
                        <option value="CONDITIONAL">让步</option>
                        <option value="FAIL">不合格</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">处置方式</label>
                      <select value={oqcShowDetail.disposition || ''} onChange={e => setOqcShowDetail({...oqcShowDetail, disposition: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择处置</option>
                        <option value="PASS">放行</option>
                        <option value="REWORK">返工</option>
                        <option value="SCRAP">报废</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">总数量</label>
                      <input type="number" value={oqcShowDetail.quantityTotal}
                        onChange={e => setOqcShowDetail({...oqcShowDetail, quantityTotal: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">抽样数量</label>
                      <input type="number" value={oqcShowDetail.quantitySampled}
                        onChange={e => setOqcShowDetail({...oqcShowDetail, quantitySampled: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                      <input type="date" value={oqcShowDetail.checkDate ? oqcShowDetail.checkDate.slice(0, 10) : ''}
                        onChange={e => setOqcShowDetail({...oqcShowDetail, checkDate: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                      <input type="text" value={oqcShowDetail.inspector || ''}
                        onChange={e => setOqcShowDetail({...oqcShowDetail, inspector: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">报告</label>
                      <div className="flex items-center gap-2">
                        <input type="file" id="oqcDetailReportUpload" accept=".pdf,.doc,.docx,image/*" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const fd = new FormData()
                            fd.append('file', file)
                            const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
                            const data = await res.json()
                            if (data.url) setOqcShowDetail({...oqcShowDetail, reportUrl: data.url})
                          }}
                        />
                        <button type="button" onClick={() => document.getElementById('oqcDetailReportUpload')?.click()}
                          className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">选择文件上传</button>
                        {oqcShowDetail.reportUrl ? (
                          <><span className="text-xs text-green-600">✓ 已上传</span>
                            <button onClick={() => setOqcShowDetail({...oqcShowDetail, reportUrl: ''})} className="text-red-500 text-xs ml-1">移除</button>
                            <a href={oqcShowDetail.reportUrl} target="_blank" className="text-blue-500 text-xs ml-2 hover:underline">查看</a></>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={oqcShowDetail.remark || ''}
                        onChange={e => setOqcShowDetail({...oqcShowDetail, remark: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setOqcShowDetail(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={() => { handleOqcDelete(oqcShowDetail.id); setOqcShowDetail(null) }} className="px-4 py-2 text-red-600 text-sm">删除</button>
                    <button onClick={handleOqcUpdate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">保存</button>
                  </div>
                </div>
              </div>
            )}

            {/* OQC 列表 */}
            {oqcLoading ? (
              <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
            ) : oqcItems.length === 0 ? (
              <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div className="empty-state-title">暂无出厂检验记录</div><div className="empty-state-desc">点击上方"新建出厂检验"开始</div></div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="bg-[var(--color-bg)] border-b">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">产品</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">批次号</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">总数</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">抽检</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">检验人</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">日期</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">结果</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">处置</th>
                      <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oqcItems.map(i => (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={i.product?.name || '-'}>{i.product?.name || '-'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{i.batchNo}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{i.quantityTotal}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{i.quantitySampled}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">{i.inspector || '-'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{i.checkDate ? new Date(i.checkDate).toLocaleDateString('zh-CN') : '-'}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[i.result] || ''}`}>{RESULT_LABELS[i.result] || i.result}</span></td>
                        <td className="px-4 py-3 text-center text-xs whitespace-nowrap">{i.disposition ? (OQC_DISPOSITION_LABELS[i.disposition] || i.disposition) : '-'}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap"><button onClick={() => setOqcShowDetail(i)} className="text-emerald-600 hover:text-emerald-800 text-xs">编辑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
