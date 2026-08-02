'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 20

interface PackagingBomItem {
  name: string
  spec: string
  supplier: string
  qty: number
  unitPrice: number
}

interface ProductDesign {
  id: string
  name: string
  brand: string | null
  category: string | null
  capacity: string | null
  status: string
  formulaId: string | null
  packagingBom: PackagingBomItem[] | null
  formula: { name: string; code: string } | null
  remark: string | null
  createdAt: string
}

// 产品状态顺序定义（与后端一致）
const STATUS_ORDER: Record<string, number> = {
  CONCEPT: 0,
  DESIGNING: 1,
  SAMPLING: 2,
  TESTING: 3,
  REGISTERING: 4,
  READY: 5,
  LAUNCHED: 6,
  DISCONTINUED: 7,
}

// 获取某个状态所有允许的下一个状态
function getAllowedNextStatuses(currentStatus: string): string[] {
  const allowed: string[] = []
  const currentIdx = STATUS_ORDER[currentStatus]
  if (currentIdx === undefined) return allowed
  // DISCONTINUED 是终态
  if (currentStatus === 'DISCONTINUED') return allowed
  // 任何状态都可以转为 DISCONTINUED
  allowed.push('DISCONTINUED')
  // 正常前进：只能到下一个状态
  const nextIdx = currentIdx + 1
  const nextStatus = Object.entries(STATUS_ORDER).find(
    ([, idx]) => idx === nextIdx
  )?.[0]
  if (nextStatus) allowed.push(nextStatus)
  return allowed
}

const STATUS_LABELS: Record<string, string> = {
  CONCEPT: '概念',
  DESIGNING: '设计中',
  SAMPLING: '打样',
  TESTING: '检测中',
  REGISTERING: '备案中',
  READY: '可量产',
  LAUNCHED: '已上市',
  DISCONTINUED: '已停产',
}

const STATUS_COLORS: Record<string, string> = {
  CONCEPT: 'bg-gray-100 text-gray-600',
  DESIGNING: 'bg-blue-100 text-blue-700',
  SAMPLING: 'bg-yellow-100 text-yellow-700',
  TESTING: 'bg-orange-100 text-orange-700',
  REGISTERING: 'bg-purple-100 text-purple-700',
  READY: 'bg-green-100 text-green-700',
  LAUNCHED: 'bg-emerald-100 text-emerald-700',
  DISCONTINUED: 'bg-red-100 text-red-600',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductDesign | null>(null)
  const [formulas, setFormulas] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ name: '', brand: '靘靓', category: '', capacity: '', formulaId: '', remark: '', status: '' })
  const [bomItems, setBomItems] = useState<PackagingBomItem[]>([])
  const router = useRouter()
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [pRes, fRes] = await Promise.all([
      fetch('/api/rnd/products'),
      fetch('/api/rnd/formulas'),
    ])
    const pData = await pRes.json()
    if (!pRes.ok) throw new Error(pData.error || '加载产品失败')
    const fData = await fRes.json()
    if (!fRes.ok) throw new Error(fData.error || '加载配方失败')
    setProducts(pData.data || pData.productDesigns || pData.products || [])
    setFormulas((fData.data || fData.formulas || []).map((f: any) => ({ id: f.id, name: f.name })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const paginatedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setEditProduct(null)
    setForm({ name: '', brand: '靘靓', category: '', capacity: '', formulaId: '', remark: '', status: '' })
    setBomItems([])
    setShowForm(true)
  }

  const openEdit = (p: ProductDesign) => {
    setEditProduct(p)
    setForm({
      name: p.name,
      brand: p.brand || '靘靓',
      category: p.category || '',
      capacity: p.capacity || '',
      formulaId: p.formulaId || '',
      remark: p.remark || '',
      status: '', // 状态通过下拉单独处理
    })
    setBomItems(p.packagingBom || [])
    setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload: any = {
      ...form,
      packagingBom: bomItems.length > 0 ? bomItems : null,
    }

    // 如果有选择新状态则传递
    if (editProduct && form.status && form.status !== editProduct.status) {
      payload.status = form.status
    }
    // 新建产品时传递状态（如果有选择）
    if (!editProduct && form.status) {
      payload.status = form.status
    }

    const url = editProduct ? `/api/rnd/products/${editProduct.id}` : '/api/rnd/products'
    const method = editProduct ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setShowForm(false)
      setEditProduct(null)
      setForm({ name: '', brand: '靘靓', category: '', capacity: '', formulaId: '', remark: '', status: '' })
      setBomItems([])
      fetchData()
    } else {
      const err = await res.json()
      showToast('error', err.error || '保存失败')
    }
  }

  const addBomRow = () => {
    setBomItems([...bomItems, { name: '', spec: '', supplier: '', qty: 1, unitPrice: 0 }])
  }

  const updateBomRow = (idx: number, field: keyof PackagingBomItem, value: string | number) => {
    const items = [...bomItems]
    ;(items[idx] as any)[field] = value
    setBomItems(items)
  }

  const removeBomRow = (idx: number) => {
    setBomItems(bomItems.filter((_, i) => i !== idx))
  }

  const statusLabel = (s: string) => STATUS_LABELS[s] || s

  const statusColor = (s: string) => STATUS_COLORS[s] || 'bg-[var(--color-card)]'

  const bomTotal = (items: PackagingBomItem[]) => items.reduce((s, i) => s + i.qty * (i.unitPrice || 0), 0)

  // 编辑时：当前状态 + 允许的下一个状态列表
  const allowedNextStatuses = editProduct ? getAllowedNextStatuses(editProduct.status) : []

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">产品设计</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建产品</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6">
        {/* 搜索框 */}
        <div className="mb-4">
          <input type="text" placeholder="搜索产品名称..." value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-card)]" />
        </div>

        {/* 新建/编辑 产品弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editProduct ? '编辑产品' : '新建产品'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><label className="block text-[var(--color-text-secondary)] mb-1">产品名称 *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">品牌</label><input type="text" value={form.brand} className="w-full px-3 py-1.5 border rounded text-sm bg-[var(--color-bg)]" disabled /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">品类</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">选择</option>
                    <option value="精华">精华</option>
                    <option value="面霜">面霜</option>
                    <option value="乳液">乳液</option>
                    <option value="面膜">面膜</option>
                    <option value="喷雾">喷雾</option>
                    <option value="洁面">洁面</option>
                  </select>
                </div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">容量</label><input type="text" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="30ml" /></div>

                {/* 状态切换区域 - 仅编辑时显示 */}
                {editProduct && (
                  <div className="col-span-2">
                    <label className="block text-[var(--color-text-secondary)] mb-1">状态切换</label>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(editProduct.status)}`}>
                        当前：{statusLabel(editProduct.status)}
                      </span>
                      {allowedNextStatuses.length > 0 ? (
                        <select
                          value={form.status}
                          onChange={e => setForm({...form, status: e.target.value})}
                          className="flex-1 px-3 py-1.5 border rounded text-sm"
                        >
                          <option value="">— 不切换 —</option>
                          {allowedNextStatuses.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-[var(--color-text-secondary)]">已到终态，不可继续转换</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">关联配方</label>
                  <select value={form.formulaId} onChange={e => setForm({...form, formulaId: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">不关联</option>
                    {formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>

              {/* 包材清单 BOM */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">包材清单</h3>
                  <button onClick={addBomRow} className="text-xs text-emerald-600 hover:text-emerald-700">+ 添加包材</button>
                </div>
                {bomItems.length > 0 && (
                  <div className="text-xs space-y-1 mb-2">
                    {bomItems.map((item, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <input type="text" value={item.name} onChange={e => updateBomRow(i, 'name', e.target.value)} placeholder="包材名称" className="flex-1 min-w-0 px-2 py-1 border rounded text-xs" />
                        <input type="text" value={item.spec} onChange={e => updateBomRow(i, 'spec', e.target.value)} placeholder="规格" className="w-20 px-2 py-1 border rounded text-xs" />
                        <input type="text" value={item.supplier} onChange={e => updateBomRow(i, 'supplier', e.target.value)} placeholder="供应商" className="w-24 px-2 py-1 border rounded text-xs" />
                        <input type="number" min="1" value={item.qty} onChange={e => updateBomRow(i, 'qty', parseInt(e.target.value) || 0)} className="w-14 px-2 py-1 border rounded text-xs text-right" />
                        <input type="number" step="0.01" min="0" value={item.unitPrice} onChange={e => updateBomRow(i, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-xs text-right" placeholder="单价" />
                        <button onClick={() => removeBomRow(i)} className="text-red-400 text-xs ml-1">×</button>
                      </div>
                    ))}
                    <div className="text-right text-[var(--color-text-secondary)] mt-1">合计: ¥{bomTotal(bomItems).toFixed(2)}</div>
                  </div>
                )}
                {bomItems.length === 0 && <p className="text-xs text-[var(--color-text-secondary)]">暂无包材，点击"添加包材"添加</p>}
              </div>

              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSubmit} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm" disabled={!form.name}>
                  {editProduct ? '保存修改' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : products.length === 0 ? (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg><div className="empty-state-title">还没有产品</div><div className="empty-state-desc">点击"新建产品"创建</div></div>
        ) : (
          <div className="space-y-3">
            {paginatedProducts.map(p => (
              <div key={p.id} className="bg-[var(--color-card)] rounded-xl border p-4 cursor-pointer hover:border-emerald-300 transition-colors" onClick={() => router.push(`/rnd/products/${p.id}`)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{p.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {p.brand} · {p.category || '未分类'} · {p.capacity || '-'}
                      {p.formula && <span> · 配方: {p.formula.name}</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p) }} className="px-3 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                </div>
                {/* 包材BOM预览 */}
                {p.packagingBom && Array.isArray(p.packagingBom) && p.packagingBom.length > 0 && (
                  <div className="mt-3 border-t pt-2">
                    <h4 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">包材清单</h4>
                    <div className="text-xs space-y-0.5">
                      {(p.packagingBom as PackagingBomItem[]).map((b, i) => (
                        <div key={i} className="flex justify-between text-[var(--color-text-secondary)]">
                          <span>{b.name} {b.spec && `(${b.spec})`} × {b.qty}</span>
                          {b.unitPrice > 0 && <span>¥{b.unitPrice.toFixed(2)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </main>
    </div>
  )
}
