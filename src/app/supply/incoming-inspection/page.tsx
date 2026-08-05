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

const DISPOSITION_LABELS: Record<string, string> = {
  USE_AS_IS: '让步使用',
  RETURN: '退回',
  SCRAP: '报废',
}

export default function IncomingInspectionPage() {
  const [items, setItems] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [form, setForm] = useState<any>({
    rawMaterialId: '',
    batchId: '',
    supplierBatchNo: '',
    quantityReceived: '',
    unit: 'kg',
    receiptDate: new Date().toISOString().slice(0, 10),
    coaVerified: false,
    coaResult: '',
    sampleQty: '',
    sampleLocation: '',
    samplePerson: '',
    inspectionDate: '',
    inspector: '',
    result: 'PENDING',
    nonConformity: '',
    disposition: '',
    remark: '',
  })
  const router = useRouter()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (resultFilter) params.set('result', resultFilter)

    const [iRes, mRes] = await Promise.all([
      apiFetch(`/api/supply/incoming-inspection?${params}`),
      apiFetch('/api/rnd/materials?q='),
    ])
    const iData = await iRes.json()
    if (!iRes.ok) throw new Error(iData.error || '加载质检记录失败')
    setItems(iData.data || iData.items || [])
    const mData = await mRes.json()
    if (!mRes.ok) throw new Error(mData.error || '加载原料失败')
    setMaterials(mData.rawMaterials || [])
    setLoading(false)
  }, [search, resultFilter])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 选择原料后加载库存批次
  const handleMaterialChange = async (materialId: string) => {
    setForm({ ...form, rawMaterialId: materialId, batchId: '' })
    if (materialId) {
      const res = await apiFetch(`/api/supply/inventory?materialId=${materialId}`)
      const data = await res.json()
      setBatches(data.data || data.items || [])
    } else {
      setBatches([])
    }
  }

  const handleCreate = async () => {
    const body: any = {
      rawMaterialId: form.rawMaterialId,
      batchId: form.batchId || null,
      supplierBatchNo: form.supplierBatchNo,
      quantityReceived: parseFloat(form.quantityReceived) || 0,
      unit: form.unit,
      receiptDate: form.receiptDate,
      coaVerified: form.coaVerified,
      coaResult: form.coaResult || null,
      sampleQty: form.sampleQty || null,
      sampleLocation: form.sampleLocation || null,
      samplePerson: form.samplePerson || null,
      inspectionDate: form.inspectionDate || null,
      inspector: form.inspector || null,
      result: form.result,
      nonConformity: form.nonConformity ? JSON.parse(JSON.stringify([{ item: form.nonConformity }])) : null,
      disposition: form.disposition || null,
      remark: form.remark || null,
    }
    await apiFetch('/api/supply/incoming-inspection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setShowForm(false)
    resetForm()
    fetchData()
  }

  const handleUpdate = async () => {
    if (!showDetail) return
    await apiFetch(`/api/supply/incoming-inspection/${showDetail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result: showDetail.result,
        disposition: showDetail.disposition,
        nonConformity: showDetail.nonConformity,
        sampleQty: showDetail.sampleQty,
        sampleLocation: showDetail.sampleLocation,
        samplePerson: showDetail.samplePerson,
        inspectionDate: showDetail.inspectionDate,
        inspector: showDetail.inspector,
        coaVerified: showDetail.coaVerified,
        coaResult: showDetail.coaResult,
        remark: showDetail.remark,
      }),
    })
    setShowDetail(null)
    fetchData()
  }

  const resetForm = () => {
    setForm({
      rawMaterialId: '',
      batchId: '',
      supplierBatchNo: '',
      quantityReceived: '',
      unit: 'kg',
      receiptDate: new Date().toISOString().slice(0, 10),
      coaVerified: false,
      coaResult: '',
      sampleQty: '',
      sampleLocation: '',
      samplePerson: '',
      inspectionDate: '',
      inspector: '',
      result: 'PENDING',
      nonConformity: '',
      disposition: '',
      remark: '',
    })
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">到货质检</h1>
            <span className="text-xs text-[var(--color-text-secondary)]">IQC — Incoming Quality Control</span>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">+ 新建质检</button>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 搜索 & 筛选 */}
        <div className="mb-4 flex gap-3">
          <input type="text" placeholder="搜索原料名 / 供应商批次..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
          <select value={resultFilter} onChange={e => setResultFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm">
            <option value="">全部状态</option>
            <option value="PENDING">待检</option>
            <option value="PASS">通过</option>
            <option value="CONDITIONAL">让步接收</option>
            <option value="FAIL">不合格</option>
          </select>
        </div>

        {/* 新建弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">新建到货质检</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {/* 基本信息 */}
                <div className="sm:col-span-2 border-b pb-3 mb-1">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">基本信息</span>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">原料 *</label>
                  <select value={form.rawMaterialId} onChange={e => handleMaterialChange(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">选择原料</option>
                    {materials.map((m: any) => <option key={m.id} value={m.id}>{m.nameCn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">关联批次（可选）</label>
                  <select value={form.batchId} onChange={e => setForm({...form, batchId: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">不关联</option>
                    {batches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.batchNo} ({b.internalBatch})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">供应商批次号 *</label>
                  <input type="text" value={form.supplierBatchNo} onChange={e => setForm({...form, supplierBatchNo: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">到货数量</label>
                  <div className="flex gap-1">
                    <input type="number" value={form.quantityReceived} onChange={e => setForm({...form, quantityReceived: e.target.value})}
                      className="flex-1 px-3 py-1.5 border rounded text-sm" />
                    <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
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
                  <input type="date" value={form.receiptDate} onChange={e => setForm({...form, receiptDate: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                {/* COA核对 */}
                <div className="sm:col-span-2 border-b pb-3 mb-1 mt-2">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">COA 核对</span>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.coaVerified} onChange={e => setForm({...form, coaVerified: e.target.checked})}
                      className="rounded border-[var(--color-border)]" />
                    <span className="text-[var(--color-text)]">COA 已核对</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">COA 结果</label>
                  <input type="text" value={form.coaResult} onChange={e => setForm({...form, coaResult: e.target.value})}
                    placeholder="COA 符合性说明" className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                {/* 留样登记 */}
                <div className="sm:col-span-2 border-b pb-3 mb-1 mt-2">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">留样登记</span>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">留样数量</label>
                  <input type="number" value={form.sampleQty} onChange={e => setForm({...form, sampleQty: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">留样位置</label>
                  <input type="text" value={form.sampleLocation} onChange={e => setForm({...form, sampleLocation: e.target.value})}
                    placeholder="如：A区-3号架" className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">留样人</label>
                  <input type="text" value={form.samplePerson} onChange={e => setForm({...form, samplePerson: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                {/* 检验记录 */}
                <div className="sm:col-span-2 border-b pb-3 mb-1 mt-2">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验记录</span>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                  <input type="date" value={form.inspectionDate} onChange={e => setForm({...form, inspectionDate: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                  <input type="text" value={form.inspector} onChange={e => setForm({...form, inspector: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                {/* 判定结果 */}
                <div className="sm:col-span-2 border-b pb-3 mb-1 mt-2">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">判定结果</span>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检验结果 *</label>
                  <select value={form.result} onChange={e => setForm({...form, result: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="PENDING">待检</option>
                    <option value="PASS">通过</option>
                    <option value="CONDITIONAL">让步接收</option>
                    <option value="FAIL">不合格</option>
                  </select>
                </div>
                {form.result === 'FAIL' || form.result === 'CONDITIONAL' ? (
                  <>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">处置方式</label>
                      <select value={form.disposition} onChange={e => setForm({...form, disposition: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择处置</option>
                        <option value="USE_AS_IS">让步使用</option>
                        <option value="RETURN">退回</option>
                        <option value="SCRAP">报废</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">不合格项记录</label>
                      <textarea value={form.nonConformity} onChange={e => setForm({...form, nonConformity: e.target.value})}
                        placeholder="描述不合格的具体项目..." className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </>
                ) : null}
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); resetForm() }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                  disabled={!form.rawMaterialId || !form.supplierBatchNo}>创建</button>
              </div>
            </div>
          </div>
        )}

        {/* 详情弹窗 */}
        {showDetail && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDetail(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">质检详情</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="sm:col-span-2">
                  <span className="text-[var(--color-text-secondary)]">原料：</span>
                  <span className="font-medium">{showDetail.rawMaterial?.nameCn || '-'}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">供应商批次：</span>
                  <span className="font-mono text-xs">{showDetail.supplierBatchNo}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">内部批次：</span>
                  <span className="font-mono text-xs">{showDetail.batch?.internalBatch || '-'}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">到货数量：</span>
                  <span>{showDetail.quantityReceived}{showDetail.unit}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">到货日期：</span>
                  <span>{new Date(showDetail.receiptDate).toLocaleDateString('zh-CN')}</span>
                </div>

                {/* COA */}
                <div className="sm:col-span-2 border-t pt-3 mt-1">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">COA 核对</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">COA 核对：</span>
                  <span className={showDetail.coaVerified ? 'text-green-600' : 'text-yellow-600'}>
                    {showDetail.coaVerified ? '✓ 已核对' : '○ 未核对'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">COA 结果：</span>
                  <span>{showDetail.coaResult || '-'}</span>
                </div>

                {/* 留样 */}
                <div className="sm:col-span-2 border-t pt-3 mt-1">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">留样登记</span>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">留样数量</label>
                  <input type="number" value={showDetail.sampleQty || ''}
                    onChange={e => setShowDetail({...showDetail, sampleQty: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">留样位置</label>
                  <input type="text" value={showDetail.sampleLocation || ''}
                    onChange={e => setShowDetail({...showDetail, sampleLocation: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">留样人</label>
                  <input type="text" value={showDetail.samplePerson || ''}
                    onChange={e => setShowDetail({...showDetail, samplePerson: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                {/* 检验记录 */}
                <div className="sm:col-span-2 border-t pt-3 mt-1">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">检验记录</span>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检验日期</label>
                  <input type="date" value={showDetail.inspectionDate ? showDetail.inspectionDate.slice(0, 10) : ''}
                    onChange={e => setShowDetail({...showDetail, inspectionDate: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检验人</label>
                  <input type="text" value={showDetail.inspector || ''}
                    onChange={e => setShowDetail({...showDetail, inspector: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                {/* 判定 */}
                <div className="sm:col-span-2 border-t pt-3 mt-1">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">判定结果</span>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检验结果</label>
                  <select value={showDetail.result} onChange={e => setShowDetail({...showDetail, result: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="PENDING">待检</option>
                    <option value="PASS">通过</option>
                    <option value="CONDITIONAL">让步接收</option>
                    <option value="FAIL">不合格</option>
                  </select>
                </div>
                {(showDetail.result === 'FAIL' || showDetail.result === 'CONDITIONAL') && (
                  <>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">处置方式</label>
                      <select value={showDetail.disposition || ''}
                        onChange={e => setShowDetail({...showDetail, disposition: e.target.value})}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择处置</option>
                        <option value="USE_AS_IS">让步使用</option>
                        <option value="RETURN">退回</option>
                        <option value="SCRAP">报废</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">不合格项</label>
                      <textarea value={
                        Array.isArray(showDetail.nonConformity)
                          ? showDetail.nonConformity.map((n: any) => n.item || '').join('\n')
                          : ''
                      }
                        onChange={e => setShowDetail({
                          ...showDetail,
                          nonConformity: e.target.value.split('\n').filter(Boolean).map((item: string) => ({ item }))
                        })}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={showDetail.remark || ''}
                    onChange={e => setShowDetail({...showDetail, remark: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleUpdate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">保存</button>
              </div>
            </div>
          </div>
        )}

        {/* 列表 */}
        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div className="empty-state-title">暂无质检记录</div><div className="empty-state-desc">点击右上角"新建质检"开始</div></div>
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
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={i.rawMaterial?.nameCn || '-'}>{i.rawMaterial?.nameCn || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{i.supplierBatchNo}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{i.quantityReceived}{i.unit}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{new Date(i.receiptDate).toLocaleDateString('zh-CN')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block w-2 h-2 rounded-full ${i.coaVerified ? 'bg-green-500' : 'bg-yellow-400'}`} title={i.coaVerified ? '已核对' : '未核对'} />
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[i.result] || 'text-[var(--color-text-secondary)] bg-[var(--color-card)]'}`}>
                        {RESULT_LABELS[i.result] || i.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      {i.disposition ? (DISPOSITION_LABELS[i.disposition] || i.disposition) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setShowDetail(i)} className="text-emerald-600 hover:text-emerald-800 text-xs">编辑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
