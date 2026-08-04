'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

type RawMaterialInfo = {
  id: string; nameCn: string; nameEn?: string; casNo?: string; unit: string; supplier?: string
}

type RawMaterialBatchInfo = {
  id: string; batchNo: string; internalBatch: string; quantity: number; supplier: string
  receiptDate: string; expireDate?: string; status: string
  rawMaterial: RawMaterialInfo
  coaFiles?: { id: string; originalName: string }[]
}

type TraceItemInfo = {
  id: string; usagePercentage?: number; remark?: string
  rawMaterialBatch: RawMaterialBatchInfo | null
}

type SalesOrderInfo = {
  id: string; orderNo: string; productName: string; quantity: number
  unitPrice: number; totalAmount: number; orderDate: string; status: string
  trackingNo?: string | null
}

type ProductDesignInfo = {
  id: string; name: string; brand?: string | null; category?: string | null; capacity?: string | null; status?: string
}

type BatchInfo = {
  id: string; productId: string; batchNo: string; productionDate: string
  quantity: number; status: string; registrationNo?: string; remark?: string
  createdAt: string; productName?: string; productBrand?: string | null
  traceItems?: TraceItemInfo[]; salesOrders?: SalesOrderInfo[]
}

// 状态标签样式
const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    IN_STOCK: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    SHIPPED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return map[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    IN_STOCK: '在库',
    PENDING: '待处理',
    SHIPPED: '已发货',
    DELIVERED: '已签收',
    DRAFT: '草稿',
    CANCELLED: '已取消',
    PROCESSING: '生产中',
    COMPLETED: '已完成',
  }
  return map[status] || status
}

export default function TraceabilityPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ productId: '', productionDate: '', quantity: '', registrationNo: '', remark: '' })
  const [traceItems, setTraceItems] = useState<{ materialId: string; batchId: string; usagePercentage: string; batchLabel: string }[]>([])
  const router = useRouter()

  // 搜索结果（来自新 search 端点）
  const [searchResults, setSearchResults] = useState<{
    productBatches: BatchInfo[]
    rawMaterialBatches: any[]
    designProductBatches: BatchInfo[]
    matchedDesigns: any[]
    keyword: string
  } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchMode, setSearchMode] = useState(false)

  // 详情弹窗
  const [detailBatch, setDetailBatch] = useState<{
    productBatch: BatchInfo
    productDesign: ProductDesignInfo | null
    traceChain: TraceItemInfo[]
    salesOrders: SalesOrderInfo[]
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setSearchResults(null)
    setSearchMode(false)
    const [bRes, pRes, mRes] = await Promise.all([
      apiFetch(`/api/supply/traceability?q=${search}`),
      apiFetch('/api/rnd/products'),
      apiFetch('/api/rnd/materials?q='),
    ])
    const bData = await bRes.json()
    if (!bRes.ok) throw new Error(bData.error || '加载批次失败')
    setBatches(bData.batches || [])
    const pData = await pRes.json()
    if (!pRes.ok) throw new Error(pData.error || '加载产品失败')
    setProducts(pData.products || [])
    const mData = await mRes.json()
    if (!mRes.ok) throw new Error(mData.error || '加载原料失败')
    setMaterials(mData.rawMaterials || [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 按关键字搜索（使用新的 search 端点）
  const handleSearch = async () => {
    if (!search.trim()) {
      setSearchResults(null)
      setSearchMode(false)
      return fetchData()
    }
    setSearching(true)
    setSearchMode(true)
    try {
      const res = await apiFetch(`/api/supply/traceability/search?keyword=${encodeURIComponent(search.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || '搜索失败')
        return
      }
      const data = await res.json()
      setSearchResults(data)
    } catch (e) {
      alert('搜索请求失败')
    } finally {
      setSearching(false)
    }
  }

  // Enter 键触发搜索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // 查看溯源详情
  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await apiFetch(`/api/supply/traceability/${id}`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || '加载详情失败')
        return
      }
      const data = await res.json()
      setDetailBatch(data)
    } catch (e) {
      alert('加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCreate = async () => {
    const items = traceItems
      .filter(i => i.batchId)
      .map(i => ({
        rawMaterialBatchId: i.batchId,
        usagePercentage: i.usagePercentage ? parseFloat(i.usagePercentage) : null,
      }))
    await apiFetch('/api/supply/traceability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: parseInt(form.quantity) || 0, traceItems: items }),
    })
    setShowForm(false)
    setForm({ productId: '', productionDate: '', quantity: '', registrationNo: '', remark: '' })
    setTraceItems([])
    if (searchMode) {
      handleSearch()
    } else {
      fetchData()
    }
  }

  const [materialBatchesMap, setMaterialBatchesMap] = useState<Record<string, any[]>>({})

  const loadBatchesForMaterial = async (materialId: string) => {
    if (!materialId) return
    if (materialBatchesMap[materialId]) return
    const res = await apiFetch(`/api/supply/inventory?materialId=${materialId}`)
    const data = await res.json()
    const batches = data.items || []
    setMaterialBatchesMap(prev => ({ ...prev, [materialId]: batches }))
  }

  const addTraceItem = () => {
    setTraceItems([...traceItems, { materialId: '', batchId: '', usagePercentage: '', batchLabel: '' }])
  }

  const updateTraceItem = (index: number, field: string, value: string) => {
    const items = [...traceItems]
    if (field === 'materialId') {
      items[index].materialId = value
      items[index].batchId = ''
      items[index].batchLabel = ''
      if (value) loadBatchesForMaterial(value)
    } else if (field === 'batchId') {
      items[index].batchId = value
      const batches = materialBatchesMap[items[index].materialId] || []
      const selected = batches.find((b: any) => b.id === value)
      items[index].batchLabel = selected ? `${selected.internalBatch || selected.batchNo}` : ''
    } else if (field === 'usagePercentage') {
      items[index].usagePercentage = value
    }
    setTraceItems(items)
  }

  // ====== 渲染组件 ======

  // 溯源详情弹窗
  const renderDetailModal = () => {
    if (!detailBatch) return null
    const { productBatch, productDesign, traceChain, salesOrders } = detailBatch

    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDetailBatch(null)}>
        <div className="bg-[var(--color-card)] dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)] dark:text-gray-100">
                溯源详情 — {productDesign?.name || '未知产品'}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                批次号: <span className="font-mono">{productBatch.batchNo}</span>
                &nbsp;|&nbsp;生产日期: {new Date(productBatch.productionDate).toLocaleDateString('zh-CN')}
                &nbsp;|&nbsp;数量: {productBatch.quantity} 件
              </p>
            </div>
            <button onClick={() => setDetailBatch(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">&times;</button>
          </div>

          {/* 时间线 */}
          <div className="relative">
            {/* === 上游：原料批次 === */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                原料批次溯源（上游）
              </h3>
            </div>
            {traceChain.length === 0 ? (
              <div className="ml-6 pl-6 pb-6 border-l-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-sm text-[var(--color-text-secondary)]">无原料批次记录</div>
              </div>
            ) : (
              <div className="ml-6 pl-6 border-l-2 border-emerald-300 dark:border-emerald-700 space-y-4 mb-6">
                {traceChain.map((item, idx) => (
                  <div key={item.id} className="relative">
                    {/* 时间线圆点 */}
                    <div className="absolute -left-[26px] top-1 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 border-2 border-emerald-400 dark:border-emerald-600 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    {/* 卡片 */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-sm text-[var(--color-text)] dark:text-gray-100">
                            {item.rawMaterialBatch?.rawMaterial?.nameCn || '未知原料'}
                          </span>
                          {item.rawMaterialBatch?.rawMaterial?.casNo && (
                            <span className="text-xs text-[var(--color-text-secondary)] ml-2">CAS: {item.rawMaterialBatch.rawMaterial.casNo}</span>
                          )}
                        </div>
                        {item.usagePercentage && (
                          <span className="text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded text-[var(--color-text-secondary)]">
                            占比 {item.usagePercentage}%
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span>原料批号: <span className="font-mono text-[var(--color-text)] dark:text-gray-200">{item.rawMaterialBatch?.internalBatch || item.rawMaterialBatch?.batchNo || '-'}</span></span>
                        <span>供应商: {item.rawMaterialBatch?.supplier || '-'}</span>
                        <span>数量: {item.rawMaterialBatch?.quantity}{item.rawMaterialBatch?.rawMaterial?.unit || 'kg'}</span>
                        {item.rawMaterialBatch?.receiptDate && (
                          <span>入库: {new Date(item.rawMaterialBatch.receiptDate).toLocaleDateString('zh-CN')}</span>
                        )}
                        {item.rawMaterialBatch?.expireDate && (
                          <span>有效期至: {new Date(item.rawMaterialBatch.expireDate).toLocaleDateString('zh-CN')}</span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${statusBadge(item.rawMaterialBatch?.status || '')}`}>
                          {statusLabel(item.rawMaterialBatch?.status || '')}
                        </span>
                      </div>
                      {/* 批次 COA（随采购批次保留，溯源查询） */}
                      <div className="mt-1.5">
                        {item.rawMaterialBatch?.coaFiles && item.rawMaterialBatch.coaFiles.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-medium text-emerald-600">COA:</span>
                            {item.rawMaterialBatch.coaFiles.map(f => (
                              <a
                                key={f.id}
                                href={`/api/files/download/${f.id}`}
                                target="_blank"
                                title="查看该批次 COA 报告"
                                className="text-[11px] text-blue-600 hover:underline truncate max-w-[200px]"
                              >
                                {f.originalName}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--color-text-secondary)]">COA 未上传（可在原料库存批次管理补传）</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === 中游：产品批次 === */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                产品批次（当前）
              </h3>
            </div>
            <div className="ml-6 pl-6 pb-6 border-l-2 border-blue-300 dark:border-blue-700">
              <div className="relative">
                <div className="absolute -left-[26px] top-1 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-400 dark:border-blue-600 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium text-sm text-[var(--color-text)] dark:text-gray-100">
                        {productDesign?.name || '未知产品'}
                      </span>
                      {productDesign?.brand && (
                        <span className="text-xs text-[var(--color-text-secondary)] ml-2">{productDesign.brand}</span>
                      )}
                    </div>
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${statusBadge(productBatch.status)}`}>
                      {statusLabel(productBatch.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--color-text-secondary)]">
                    <span>生产批号: <span className="font-mono text-[var(--color-text)] dark:text-gray-200">{productBatch.batchNo}</span></span>
                    <span>数量: {productBatch.quantity} 件</span>
                    <span>生产日期: {new Date(productBatch.productionDate).toLocaleDateString('zh-CN')}</span>
                    {productBatch.registrationNo && <span>备案号: {productBatch.registrationNo}</span>}
                    {productDesign?.category && <span>类别: {productDesign.category}</span>}
                    {productDesign?.capacity && <span>规格: {productDesign.capacity}</span>}
                  </div>
                  {productBatch.remark && (
                    <div className="mt-1.5 text-xs text-[var(--color-text-secondary)]">备注: {productBatch.remark}</div>
                  )}
                </div>
              </div>
            </div>

            {/* === 下游：销售订单 === */}
            <div className="mt-2 mb-2">
              <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                销售订单（下游）
              </h3>
            </div>
            <div className="ml-6 pl-6 border-l-2 border-purple-300 dark:border-purple-700 space-y-3">
              {salesOrders.length === 0 ? (
                <div className="text-sm text-[var(--color-text-secondary)]">暂无关联销售订单</div>
              ) : (
                salesOrders.map(order => (
                  <div key={order.id} className="relative">
                    <div className="absolute -left-[26px] top-1 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-400 dark:border-purple-600 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    </div>
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-sm text-[var(--color-text)] dark:text-gray-100">
                            {order.orderNo}
                          </span>
                          {order.productName && (
                            <span className="text-xs text-[var(--color-text-secondary)] ml-2">{order.productName}</span>
                          )}
                        </div>
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${statusBadge(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span>数量: {order.quantity}</span>
                        <span>单价: ¥{order.unitPrice?.toFixed(2)}</span>
                        <span>总额: ¥{order.totalAmount?.toFixed(2)}</span>
                        <span>日期: {new Date(order.orderDate).toLocaleDateString('zh-CN')}</span>
                        {order.trackingNo && <span>物流单号: {order.trackingNo}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 渲染批次卡片
  const renderBatchCard = (b: BatchInfo) => (
    <div
      key={b.id}
      className="bg-[var(--color-card)] dark:bg-gray-800 rounded-xl border border-[var(--color-border)] dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => openDetail(b.id)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-[var(--color-text)] dark:text-gray-200">{b.batchNo}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[var(--color-text-secondary)]">{b.productName || '未知产品'}</span>
          {b.productBrand && <span className="text-xs text-[var(--color-text-secondary)]">{b.productBrand}</span>}
          <span className="text-xs text-[var(--color-text-secondary)]">{b.quantity} 件</span>
          <span className="text-xs text-[var(--color-text-secondary)]">{new Date(b.productionDate).toLocaleDateString('zh-CN')}</span>
        </div>
        <div className="flex items-center gap-2">
          {b.registrationNo && <span className="text-xs text-[var(--color-text-secondary)]">备案: {b.registrationNo}</span>}
          {(b.salesOrders?.length || 0) > 0 && (
            <span className="text-xs text-purple-500 dark:text-purple-400">{b.salesOrders!.length} 笔订单</span>
          )}
          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      {b.traceItems && b.traceItems.length > 0 && (
        <div className="border-t border-[var(--color-border)] dark:border-gray-700 pt-2">
          <div className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] mb-1">使用原料 ({b.traceItems.length} 种):</div>
          <div className="flex flex-wrap gap-2">
            {b.traceItems.map((t, j) => (
              <span key={j} className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                {t.rawMaterialBatch?.rawMaterial?.nameCn || '-'}
                {t.usagePercentage ? ` (${t.usagePercentage}%)` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // 无搜索时的批量列表
  const renderBatchList = () => {
    if (loading) {
      return (
        <div className="space-y-3 p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      )
    }
    if (batches.length === 0) {
      return (
        <div className="empty-state">
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div className="empty-state-title">{search ? '无匹配批次' : '暂无溯源记录'}</div>
          <div className="empty-state-desc">点击右上角"新建批次"开始</div>
        </div>
      )
    }
    return <div className="space-y-3">{batches.map(renderBatchCard)}</div>
  }

  // 搜索结果渲染（时间线风格）
  const renderSearchResults = () => {
    if (!searchResults) return null
    const { productBatches, rawMaterialBatches, designProductBatches, matchedDesigns, keyword } = searchResults

    const totalResults = productBatches.length + rawMaterialBatches.length + designProductBatches.length

    return (
      <div className="space-y-4">
        <div className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">
          搜索结果 &quot;{keyword}&quot; — 找到 {totalResults} 条记录
        </div>

        {/* 按产品批次搜索结果 */}
        {productBatches.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              产品批次 ({productBatches.length})
            </h3>
            <div className="space-y-3">{productBatches.map(renderBatchCard)}</div>
          </div>
        )}

        {/* 按产品名搜索结果 */}
        {designProductBatches.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              产品名称匹配 ({designProductBatches.length})
            </h3>
            <div className="space-y-3">{designProductBatches.map(renderBatchCard)}</div>
          </div>
        )}

        {/* 原料批次搜索结果 */}
        {rawMaterialBatches.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              原料批次 ({rawMaterialBatches.length})
            </h3>
            <div className="space-y-2">
              {rawMaterialBatches.map((rb: any) => (
                <div key={rb.id} className="bg-[var(--color-card)] dark:bg-gray-800 rounded-xl border border-[var(--color-border)] dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-[var(--color-text)] dark:text-gray-200">{rb.internalBatch || rb.batchNo}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{rb.rawMaterial?.nameCn || '未知原料'}</span>
                    </div>
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${statusBadge(rb.status)}`}>{statusLabel(rb.status)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-[var(--color-text-secondary)] mb-2">
                    <span>供应商: {rb.supplier || '-'}</span>
                    <span>数量: {rb.quantity}{rb.rawMaterial?.unit || 'kg'}</span>
                    {rb.receiptDate && <span>入库: {new Date(rb.receiptDate).toLocaleDateString('zh-CN')}</span>}
                  </div>
                  {rb.linkedProductBatches && rb.linkedProductBatches.length > 0 && (
                    <div className="border-t border-[var(--color-border)] dark:border-gray-700 pt-2">
                      <div className="text-xs text-[var(--color-text-secondary)] mb-1">关联产品批次:</div>
                      <div className="flex flex-wrap gap-2">
                        {rb.linkedProductBatches.map((lp: any) => (
                          <button
                            key={lp.id}
                            onClick={(e) => { e.stopPropagation(); openDetail(lp.id) }}
                            className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                          >
                            {lp.batchNo}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 点击原料批号可查看其关联产品 */}
                  {(!rb.linkedProductBatches || rb.linkedProductBatches.length === 0) && (
                    <div className="text-xs text-[var(--color-text-secondary)] italic">未关联到产品批次</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {totalResults === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">未找到匹配结果</div>
            <div className="empty-state-desc">尝试其他关键词</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] dark:bg-gray-950">
      <header className="bg-[var(--color-card)] dark:bg-gray-900 border-b border-[var(--color-border)] dark:border-gray-800 sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] dark:hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
              <h1 className="text-xl font-bold text-[var(--color-text)] dark:text-gray-100">溯源系统</h1>
            </div>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">+ 新建批次</button>
          </div>

          {/* 搜索栏 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="搜索产品批号 / 原料批号 / 产品名称..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2 pl-10 border border-[var(--color-border)] dark:border-gray-700 rounded-lg text-sm bg-[var(--color-card)] dark:bg-gray-800 text-[var(--color-text)] dark:text-gray-100"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !search.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {searching ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>搜索中</>
              ) : '搜索'}
            </button>
            {searchMode && (
              <button
                onClick={() => { setSearch(''); setSearchResults(null); setSearchMode(false); fetchData() }}
                className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)] dark:border-gray-700 rounded-lg"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 新建批次表单（保持不变） */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)] dark:text-gray-100">新建产品批次</h2>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] mb-1">关联产品 *</label>
                  <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100">
                    <option value="">选择产品</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] mb-1">生产日期 *</label>
                  <input type="date" value={form.productionDate} onChange={e => setForm({...form, productionDate: e.target.value})}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] mb-1">数量</label>
                  <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] mb-1">备案编号</label>
                  <input type="text" value={form.registrationNo} onChange={e => setForm({...form, registrationNo: e.target.value})}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100" />
                </div>
              </div>

              <h3 className="text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-text-secondary)] mb-2">使用的原料批次</h3>
              <div className="space-y-2 mb-3">
                {traceItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center text-sm">
                    <select
                      value={item.materialId}
                      onChange={e => updateTraceItem(i, 'materialId', e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100"
                    >
                      <option value="">选择原料</option>
                      {materials.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.nameCn}</option>
                      ))}
                    </select>
                    <select
                      value={item.batchId}
                      onChange={e => updateTraceItem(i, 'batchId', e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100"
                      disabled={!item.materialId}
                    >
                      <option value="">选择批次</option>
                      {(materialBatchesMap[item.materialId] || []).map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.internalBatch || b.batchNo} ({b.quantity}{b.rawMaterial?.unit || 'kg'} — {b.status === 'IN_STOCK' ? '在库' : b.status})
                        </option>
                      ))}
                    </select>
                    <input type="number" step="0.1" placeholder="用量%" value={item.usagePercentage}
                      onChange={e => updateTraceItem(i, 'usagePercentage', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-[var(--color-border)] dark:border-gray-700 rounded text-right text-sm bg-[var(--color-card)] dark:bg-gray-700 text-[var(--color-text)] dark:text-gray-100" />
                    <button onClick={() => setTraceItems(traceItems.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-xs px-1">×</button>
                  </div>
                ))}
              </div>
              {traceItems.length === 0 && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">请添加使用的原料批次以建立追溯关系</p>
              )}
              <button onClick={addTraceItem}
                className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 block">+ 添加原料批次</button>

              <div className="flex gap-2 justify-end border-t border-[var(--color-border)] dark:border-gray-700 pt-4">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] text-sm hover:text-[var(--color-text)]">取消</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!form.productId || !form.productionDate}>保存</button>
              </div>
            </div>
          </div>
        )}

        {/* 主体内容 */}
        {searchMode ? renderSearchResults() : renderBatchList()}
      </main>

      {/* 溯源详情弹窗 */}
      {detailLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-[var(--color-card)] dark:bg-gray-800 rounded-xl p-8">
            <div className="flex items-center gap-3">
              <svg className="animate-spin w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[var(--color-text-secondary)]">加载详情中...</span>
            </div>
          </div>
        </div>
      )}
      {detailBatch && renderDetailModal()}
    </div>
  )
}
