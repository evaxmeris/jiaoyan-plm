'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

// ─── 类型定义 ───

interface ProductCosting {
  id: string
  productDesignId: string
  version: number
  costingDate: string
  rawMaterialCost: number
  packagingCost: number
  oemFee: number
  testingFee: number
  certificationFee: number
  otherCost: number
  totalCost: number
  outputQty: number
  unitCost: number
  targetMargin: number | null
  suggestedPrice: number
  actualPrice: number | null
  status: string
  remark: string | null
  createdAt: string
  product: { id: string; name: string; brand: string | null; status: string }
}

interface PriceHistory {
  id: string
  productDesignId: string
  price: number
  effectiveDate: string
  channel: string | null
  reason: string | null
  createdAt: string
  product: { id: string; name: string; brand: string | null }
}

// ─── 常量 ───

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  FINAL: '已定稿',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700',
  FINAL: 'bg-green-100 text-green-700',
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN')
}

function formatMoney(n: number) {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── 组件 ───

export default function CostingPage() {
  const router = useRouter()
  const [costings, setCostings] = useState<ProductCosting[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProductId, setFilterProductId] = useState('')

  // 表单状态
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    productDesignId: '',
    costingDate: new Date().toISOString().slice(0, 10),
    rawMaterialCost: '',
    packagingCost: '',
    oemFee: '',
    testingFee: '',
    certificationFee: '',
    otherCost: '',
    outputQty: '1000',
    targetMargin: '50',
    actualPrice: '',
    remark: '',
  })

  // 价格历史弹窗
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<{ id: string; name: string } | null>(null)
  const [priceHistories, setPriceHistories] = useState<PriceHistory[]>([])
  const [showPriceForm, setShowPriceForm] = useState(false)

  // 从配方自动计算弹窗
  const [showCalcModal, setShowCalcModal] = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcResult, setCalcResult] = useState<{ unitCost: number; suggestedRawMaterialCost: number; formulaName: string; formulaCode: string; batchQty: number; items: { rawMaterialName: string; percentage: number; unitPrice: number; contribution: number; hasPrice: boolean }[] } | null>(null)
  const [calcSelectedProductId, setCalcSelectedProductId] = useState('')
  const [calcSelectedFormulaId, setCalcSelectedFormulaId] = useState('')
  const [calcBatchQty, setCalcBatchQty] = useState('1000')
  // 所有配方缓存（用于过滤）
  const [allFormulas, setAllFormulas] = useState<{ id: string; name: string; code: string; batchSize: number | null }[]>([])
  const [priceForm, setPriceForm] = useState({ price: '', effectiveDate: new Date().toISOString().slice(0, 10), channel: '', reason: '' })

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterProductId) params.set('productId', filterProductId)
    const [cRes, pRes] = await Promise.all([
      apiFetch(`/api/rnd/costing?${params}`),
      apiFetch('/api/rnd/products'),
    ])
    if (cRes.ok) {
      const c = await cRes.json()
      setCostings(c.data || c.costings || [])
    }
    if (pRes.ok) {
      const p = await pRes.json()
      setProducts(p.data || p.products || [])
    }
    setLoading(false)
  }, [filterProductId])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const openCreate = () => {
    setEditId(null)
    setForm({
      productDesignId: '',
      costingDate: new Date().toISOString().slice(0, 10),
      rawMaterialCost: '',
      packagingCost: '',
      oemFee: '',
      testingFee: '',
      certificationFee: '',
      otherCost: '',
      outputQty: '1000',
      targetMargin: '50',
      actualPrice: '',
      remark: '',
    })
    setShowForm(true)
  }

  const openEdit = (c: ProductCosting) => {
    setEditId(c.id)
    setForm({
      productDesignId: c.productDesignId,
      costingDate: c.costingDate.slice(0, 10),
      rawMaterialCost: String(c.rawMaterialCost),
      packagingCost: String(c.packagingCost),
      oemFee: String(c.oemFee),
      testingFee: String(c.testingFee),
      certificationFee: String(c.certificationFee),
      otherCost: String(c.otherCost),
      outputQty: String(c.outputQty),
      targetMargin: c.targetMargin !== null ? String(c.targetMargin) : '',
      actualPrice: c.actualPrice !== null ? String(c.actualPrice) : '',
      remark: c.remark || '',
    })
    setShowForm(true)
  }

  const submitForm = async () => {
    const url = editId ? `/api/rnd/costing/${editId}` : '/api/rnd/costing'
    const method = editId ? 'PUT' : 'POST'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setEditId(null)
      fetchData()
    } else {
      const err = await res.json()
      alert(err.error || '保存失败')
    }
  }

  const deleteCosting = async (id: string) => {
    if (!confirm('确定删除该成本核算？')) return
    const res = await apiFetch(`/api/rnd/costing/${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  const toggleStatus = async (c: ProductCosting) => {
    const newStatus = c.status === 'DRAFT' ? 'FINAL' : 'DRAFT'
    const res = await apiFetch(`/api/rnd/costing/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) fetchData()
  }

  // 价格历史
  const openPriceHistory = async (costing: ProductCosting) => {
    setPriceHistoryProduct({ id: costing.productDesignId, name: costing.product.name })
    const res = await apiFetch(`/api/rnd/price-history?productId=${costing.productDesignId}`)
    if (res.ok) {
      const d = await res.json()
      setPriceHistories(d.data || d.histories || [])
    }
    setShowPriceHistory(true)
  }

  const submitPriceForm = async () => {
    if (!priceHistoryProduct) return
    const res = await apiFetch('/api/rnd/price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productDesignId: priceHistoryProduct.id,
        ...priceForm,
      }),
    })
    if (res.ok) {
      setShowPriceForm(false)
      setPriceForm({ price: '', effectiveDate: new Date().toISOString().slice(0, 10), channel: '', reason: '' })
      // 刷新价格历史列表
      const r = await apiFetch(`/api/rnd/price-history?productId=${priceHistoryProduct.id}`)
      if (r.ok) {
        const d = await r.json()
        setPriceHistories(d.data || d.histories || [])
      }
      fetchData() // 刷新成本列表（可能更新了 actualPrice）
    } else {
      const err = await res.json()
      alert(err.error || '保存失败')
    }
  }

  // 从配方自动计算
  const openCalcModal = async () => {
    setCalcResult(null)
    setCalcSelectedFormulaId('')
    // 如果已有选中的产品，预填
    const selectedProductId = form.productDesignId
    setCalcSelectedProductId(selectedProductId)
    setCalcBatchQty(form.outputQty || '1000')

    // 加载所有配方
    const fRes = await apiFetch('/api/rnd/formulas')
    if (fRes.ok) {
      const d = await fRes.json()
      setAllFormulas(d.data || d.formulas || [])
    }
    setShowCalcModal(true)
  }

  const doCalcFromFormula = async () => {
    if (!calcSelectedProductId || !calcSelectedFormulaId) return
    setCalcLoading(true)
    setCalcResult(null)
    try {
      const res = await apiFetch('/api/rnd/costing/calc-from-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productDesignId: calcSelectedProductId,
          formulaId: calcSelectedFormulaId,
          batchQty: calcBatchQty,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCalcResult(data)
      } else {
        const err = await res.json()
        alert(err.error || '计算失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setCalcLoading(false)
    }
  }

  const applyCalcResult = () => {
    if (calcResult) {
      setForm({ ...form, rawMaterialCost: String(calcResult.suggestedRawMaterialCost) })
      setShowCalcModal(false)
    }
  }

  // 自动计算（显示用）
  const calcTotal = () => {
    const rm = parseFloat(form.rawMaterialCost) || 0
    const pc = parseFloat(form.packagingCost) || 0
    const oem = parseFloat(form.oemFee) || 0
    const tf = parseFloat(form.testingFee) || 0
    const cf = parseFloat(form.certificationFee) || 0
    const oc = parseFloat(form.otherCost) || 0
    return rm + pc + oem + tf + cf + oc
  }

  const calcUnitCost = () => {
    const qty = parseInt(form.outputQty) || 0
    return qty > 0 ? calcTotal() / qty : 0
  }

  const calcSuggestedPrice = () => {
    const unitCost = calcUnitCost()
    const margin = form.targetMargin !== '' ? parseFloat(form.targetMargin) : null
    if (margin !== null && margin > 0 && margin < 100) {
      return unitCost / (1 - margin / 100)
    } else if (margin !== null && margin >= 100) {
      return unitCost * (1 + margin / 100)
    }
    return unitCost
  }

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/rnd')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">成本核算</h1>
          </div>
          <button onClick={openCreate} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建核算</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6">
        {/* 筛选 */}
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-[var(--color-text-secondary)]">按产品：</label>
          <select
            value={filterProductId}
            onChange={(e) => setFilterProductId(e.target.value)}
            className="px-3 py-1.5 border rounded text-sm"
          >
            <option value="">全部产品</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* 列表 */}
        {costings.length === 0 ? (
          <div className="bg-[var(--color-card)] rounded-xl border p-8 text-center text-[var(--color-text-secondary)] text-sm">暂无成本核算记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[var(--color-text-secondary)]">
                  <th className="text-left py-2 px-3">产品</th>
                  <th className="text-left py-2 px-3">版本</th>
                  <th className="text-right py-2 px-3">总成本</th>
                  <th className="text-right py-2 px-3">单件成本</th>
                  <th className="text-right py-2 px-3">目标毛利率</th>
                  <th className="text-right py-2 px-3">建议售价</th>
                  <th className="text-right py-2 px-3">实际售价</th>
                  <th className="text-center py-2 px-3">状态</th>
                  <th className="text-center py-2 px-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {costings.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-[var(--color-bg)]">
                    <td className="py-2 px-3 font-medium">{c.product.name}</td>
                    <td className="py-2 px-3">v{c.version}</td>
                    <td className="py-2 px-3 text-right">{formatMoney(c.totalCost)}</td>
                    <td className="py-2 px-3 text-right">{formatMoney(c.unitCost)}</td>
                    <td className="py-2 px-3 text-right">{c.targetMargin !== null ? `${c.targetMargin}%` : '-'}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-700">{formatMoney(c.suggestedPrice)}</td>
                    <td className="py-2 px-3 text-right">
                      {c.actualPrice !== null ? (
                        <span className="text-blue-700">{formatMoney(c.actualPrice)}</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status] || ''}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                        <button onClick={() => toggleStatus(c)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">
                          {c.status === 'DRAFT' ? '定稿' : '重开'}
                        </button>
                        <button onClick={() => openPriceHistory(c)} className="px-2 py-1 text-xs border rounded text-blue-600 hover:bg-blue-50">价格</button>
                        <button onClick={() => deleteCosting(c.id)} className="px-2 py-1 text-xs border rounded text-red-400 hover:bg-red-50">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 编辑/新建弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editId ? '编辑成本核算' : '新建成本核算'}</h2>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {!editId && (
                  <div className="col-span-2">
                    <label className="block text-[var(--color-text-secondary)] mb-1">关联产品 *</label>
                    <select
                      value={form.productDesignId}
                      onChange={(e) => setForm({ ...form, productDesignId: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded text-sm"
                    >
                      <option value="">请选择产品</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">核算日期</label>
                  <input type="date" value={form.costingDate} onChange={(e) => setForm({ ...form, costingDate: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">产出数量（件/批次）</label>
                  <input type="number" value={form.outputQty} onChange={(e) => setForm({ ...form, outputQty: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">原料成本 (¥)</label>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" value={form.rawMaterialCost} onChange={(e) => setForm({ ...form, rawMaterialCost: e.target.value })}
                      className="flex-1 px-3 py-1.5 border rounded text-sm" />
                    <button type="button" onClick={openCalcModal}
                      className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">
                      从配方
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">包材成本 (¥)</label>
                  <input type="number" step="0.01" value={form.packagingCost} onChange={(e) => setForm({ ...form, packagingCost: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">代工费 (¥)</label>
                  <input type="number" step="0.01" value={form.oemFee} onChange={(e) => setForm({ ...form, oemFee: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">检测费 (¥)</label>
                  <input type="number" step="0.01" value={form.testingFee} onChange={(e) => setForm({ ...form, testingFee: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">备案/认证费 (¥)</label>
                  <input type="number" step="0.01" value={form.certificationFee} onChange={(e) => setForm({ ...form, certificationFee: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">其他费用 (¥)</label>
                  <input type="number" step="0.01" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
              </div>

              {/* 自动计算结果 */}
              <div className="mt-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">总成本：</span>
                  <span className="font-medium">{formatMoney(calcTotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">单件成本：</span>
                  <span className="font-medium">{formatMoney(calcUnitCost())}</span>
                </div>
              </div>

              {/* 定价 */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">目标毛利率 (%)</label>
                  <input type="number" step="1" value={form.targetMargin} onChange={(e) => setForm({ ...form, targetMargin: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">建议零售价（自动计算）</label>
                  <div className="px-3 py-1.5 border rounded text-sm bg-gray-50 dark:bg-zinc-800">
                    {formatMoney(calcSuggestedPrice())}
                  </div>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">实际售价 (¥)</label>
                  <input type="number" step="0.01" value={form.actualPrice} onChange={(e) => setForm({ ...form, actualPrice: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded text-sm">取消</button>
                <button onClick={submitForm} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
                  {editId ? '保存' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 价格历史弹窗 */}
        {showPriceHistory && priceHistoryProduct && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowPriceHistory(false); setShowPriceForm(false) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">价格历史 - {priceHistoryProduct.name}</h2>
                <button onClick={() => setShowPriceForm(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ 添加价格</button>
              </div>

              {priceHistories.length === 0 ? (
                <div className="text-center text-[var(--color-text-secondary)] text-sm py-8">暂无价格记录</div>
              ) : (
                <div className="space-y-2">
                  {priceHistories.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium text-blue-700">{formatMoney(h.price)}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          {formatDate(h.effectiveDate)}
                          {h.channel && ` · ${h.channel}`}
                        </div>
                      </div>
                      <div className="text-xs text-right text-[var(--color-text-secondary)]">
                        {h.reason && <div>{h.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 添加价格表单 */}
              {showPriceForm && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="font-medium text-sm mb-3">添加价格记录</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">售价 (¥) *</label>
                      <input type="number" step="0.01" value={priceForm.price}
                        onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">生效日期</label>
                      <input type="date" value={priceForm.effectiveDate}
                        onChange={(e) => setPriceForm({ ...priceForm, effectiveDate: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">渠道</label>
                      <input type="text" value={priceForm.channel}
                        onChange={(e) => setPriceForm({ ...priceForm, channel: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如 天猫" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">变更原因</label>
                      <input type="text" value={priceForm.reason}
                        onChange={(e) => setPriceForm({ ...priceForm, reason: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如 新品上市" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowPriceForm(false)} className="px-3 py-1.5 border rounded text-sm">取消</button>
                    <button onClick={submitPriceForm} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-4">
                <button onClick={() => { setShowPriceHistory(false); setShowPriceForm(false) }}
                  className="px-4 py-2 border rounded text-sm">关闭</button>
              </div>
            </div>
          </div>
        )}

        {/* 从配方自动计算弹窗 */}
        {showCalcModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCalcModal(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">从配方自动计算原料成本</h2>

              <div className="space-y-3 text-sm">
                {/* 产品选择 */}
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">产品</label>
                  <select
                    value={calcSelectedProductId}
                    onChange={(e) => {
                      setCalcSelectedProductId(e.target.value)
                      setCalcSelectedFormulaId('')
                      setCalcResult(null)
                    }}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="">请选择产品</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* 配方选择 — 过滤出所选产品关联的配方，或搜索全部 */}
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">配方</label>
                  <select
                    value={calcSelectedFormulaId}
                    onChange={(e) => {
                      setCalcSelectedFormulaId(e.target.value)
                      setCalcResult(null)
                    }}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="">请选择配方</option>
                    {allFormulas
                      .filter((f) => {
                        // 如果有选中的产品，优先显示该产品关联的配方
                        if (calcSelectedProductId) {
                          const prod = products.find((p) => p.id === calcSelectedProductId)
                          return !calcSelectedFormulaId || f.id === calcSelectedFormulaId
                        }
                        return true
                      })
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}){f.batchSize ? ` · ${f.batchSize}kg/批` : ''}
                        </option>
                      ))}
                    {/* 如果过滤后为空，显示所有配方作为后备 */}
                    {calcSelectedProductId && allFormulas.filter((f) => {
                      const prod = products.find((p) => p.id === calcSelectedProductId)
                      return !calcSelectedFormulaId || f.id === calcSelectedFormulaId
                    }).length === 0 && (
                      allFormulas.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}){f.batchSize ? ` · ${f.batchSize}kg/批` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* 批次数量 */}
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">批次产量（件/批次）</label>
                  <input
                    type="number"
                    value={calcBatchQty}
                    onChange={(e) => { setCalcBatchQty(e.target.value); setCalcResult(null) }}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                </div>

                {/* 计算按钮 */}
                <button
                  onClick={doCalcFromFormula}
                  disabled={!calcSelectedProductId || !calcSelectedFormulaId || calcLoading}
                  className="w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-40"
                >
                  {calcLoading ? '计算中...' : '计算'}
                </button>

                {/* 计算结果 */}
                {calcResult && (
                  <div className="border rounded-lg p-4 space-y-2 bg-gray-50 dark:bg-zinc-800">
                    <div className="font-medium text-sm">{calcResult.formulaName} ({calcResult.formulaCode})</div>
                    {calcResult.items.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-[var(--color-text-secondary)]">
                            <th className="text-left py-1">原料</th>
                            <th className="text-right py-1">配比%</th>
                            <th className="text-right py-1">单价</th>
                            <th className="text-right py-1">贡献</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResult.items.map((item, i) => (
                            <tr key={i} className="border-b border-gray-200 dark:border-zinc-700">
                              <td className="py-1 pr-2">
                                <span className={item.hasPrice ? '' : 'text-orange-500'}>{item.rawMaterialName}</span>
                                {!item.hasPrice && <span className="text-orange-500 ml-1">(无价格)</span>}
                              </td>
                              <td className="text-right py-1">{item.percentage}%</td>
                              <td className="text-right py-1">¥{item.unitPrice.toFixed(2)}</td>
                              <td className="text-right py-1 font-medium">¥{item.contribution.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-zinc-600">
                      <span className="text-[var(--color-text-secondary)]">每件原料成本</span>
                      <span className="font-semibold">¥{calcResult.unitCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-secondary)]">总原料成本（×{calcResult.batchQty}件）</span>
                      <span className="font-semibold text-lg text-blue-700">¥{calcResult.suggestedRawMaterialCost.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={applyCalcResult}
                      className="w-full py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 mt-2"
                    >
                      应用此成本
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <button onClick={() => setShowCalcModal(false)} className="px-4 py-2 border rounded text-sm">关闭</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
