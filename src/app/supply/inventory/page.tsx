'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X } from 'lucide-react'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import FileUploader, { type FileUploaderHandle } from '@/components/FileUploader'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const CATEGORIES = [
  { value: 'LAB_SUPPLIES', label: '实验用品', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'EQUIPMENT', label: '设备', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'OFFICE_SUPPLIES', label: '办公用品', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  { value: 'GIFTS', label: '礼品', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  { value: 'OTHER', label: '其他', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
]

function getCategoryInfo(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1]
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'raw' | 'supply'>('raw')
  const router = useRouter()
  const { showToast } = useToast()

  // 原料库存相关
  const [items, setItems] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ rawMaterialId: '', batchNo: '', quantity: '', receiptDate: '', supplier: '', remark: '' })
  // 入库弹窗预选的批次 COA 文件（入库成功后自动上传到新批次）
  const [draftCoa, setDraftCoa] = useState<File[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // 批次 COA 管理弹窗（当前批次）
  const [coaBatch, setCoaBatch] = useState<{ id: string; label: string } | null>(null)
  const coaUploaderRef = useRef<FileUploaderHandle | null>(null)

  // 物资库存相关
  const [supplies, setSupplies] = useState<any[]>([])

  const defaultForm = { rawMaterialId: '', batchNo: '', quantity: '', receiptDate: '', supplier: '', remark: '' }

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (activeTab === 'raw') {
      const [iRes, mRes] = await Promise.all([
        apiFetch(`/api/supply/inventory?q=${search}`),
        apiFetch('/api/rnd/materials?q='),
      ])
      const iData = await iRes.json()
      if (!iRes.ok) throw new Error(iData.error || '加载库存失败')
      setItems(iData.data || iData.items || [])
      const mData = await mRes.json()
      if (!mRes.ok) throw new Error(mData.error || '加载原料失败')
      setMaterials(mData.rawMaterials || [])
    } else {
      const res = await apiFetch(`/api/supply/supplies?q=${search}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载物资失败')
      setSupplies(data.data || data.supplies || [])
    }
    setLoading(false)
  }, [search, activeTab])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setDraftCoa([])
    setShowForm(true)
  }

  const openEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      rawMaterialId: item.rawMaterialId || '',
      batchNo: item.batchNo || '',
      quantity: item.quantity?.toString() || '',
      receiptDate: item.receiptDate ? item.receiptDate.slice(0, 10) : '',
      supplier: item.supplier || '',
      remark: item.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const url = editingId ? `/api/supply/inventory/${editingId}` : '/api/supply/inventory'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      const savedId = editingId || json?.data?.id || json?.id
      setShowForm(false)
      setEditingId(null)
      // 新增入库：预选的批次 COA 文件自动上传到新批次（先建批次后传文件）
      if (!editingId && savedId && draftCoa.length > 0) {
        for (const file of draftCoa) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('entityType', 'RawMaterialBatch')
            fd.append('entityId', savedId)
            fd.append('fileType', 'COA')
            await apiFetch('/api/files', { method: 'POST', body: fd })
          } catch {
            /* 单个文件失败不阻断其余上传 */
          }
        }
        showToast('success', '入库成功，批次 COA 已上传')
      } else {
        showToast('success', editingId ? '修改成功' : '入库成功')
      }
      setDraftCoa([])
      fetchData()
    } else {
      const err = await res.json()
      showToast('error', err.error || (editingId ? '更新失败' : '入库失败'))
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/supply/inventory/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">库存管理</h1>
          </div>
          {activeTab === 'raw' && (
            <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 入库</button>
          )}
        </div>
      </header>

      {/* Tab切换 */}
      <div className="w-full mx-auto px-4 md:px-6 pt-4">
        <div className="flex gap-1 bg-[var(--color-card)] rounded-lg p-1 border w-fit">
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${activeTab === 'raw' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'}`}
          >
            原料库存
          </button>
          <button
            onClick={() => setActiveTab('supply')}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${activeTab === 'supply' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'}`}
          >
            物资库存
          </button>
        </div>
      </div>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="mb-4">
          <input type="text" placeholder={activeTab === 'raw' ? '搜索批次号 / 供应商...' : '搜索物资名称...'} value={search}
            onChange={e => setSearch(e.target.value)} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
        </div>

        {/* 原料库存 Tab */}
        {activeTab === 'raw' && (
          <>
            {showForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑库存批次' : '原料入库'}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="sm:col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">原料 *</label>
                      <select value={form.rawMaterialId} onChange={e => {
                        const m = materials.find((x: any) => x.id === e.target.value)
                        // 原料管理按「行=原料×厂家」建模，选中原料即确定厂家，供应商自动带出
                        setForm({...form, rawMaterialId: e.target.value, supplier: m?.supplier || ''})
                      }} className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择原料</option>
                        {/* 同一原料不同厂家分别建档，下拉显示「原料名-厂家名」便于区分 */}
                        {materials.map((m: any) => <option key={m.id} value={m.id}>{m.nameCn}{m.supplier ? `-${m.supplier}` : ''}</option>)}
                      </select>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">原料按厂家分别建档，选择原料后自动带出对应厂家</p>
                    </div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">供应商批次号 *</label><input type="text" value={form.batchNo} onChange={e => setForm({...form, batchNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">数量 *</label><input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div className="sm:col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">供应商（自动带出）</label>
                      <input type="text" value={form.supplier} readOnly placeholder="选择原料后自动带出厂家"
                        className="w-full px-3 py-1.5 border rounded text-sm bg-[var(--color-bg)] text-[var(--color-text-secondary)] cursor-not-allowed" />
                      {!form.supplier && form.rawMaterialId && (
                        <p className="text-[11px] text-red-500 mt-1">该原料未关联供应商，请先在原料管理中完善</p>
                      )}
                    </div>
                    {/* 批次检验证书（COA）：入库时预选，入库成功后自动上传到本批次 */}
                    {!editingId && (
                      <div className="sm:col-span-2">
                        <label className="block text-[var(--color-text-secondary)] mb-1">批次检验证书 (COA)</label>
                        <div className="border border-[var(--color-border)] rounded-lg px-3 py-2">
                          {draftCoa.length > 0 && (
                            <div className="space-y-1 mb-2">
                              {draftCoa.map((f, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[220px]">{f.name}</span>
                                  <button type="button" title="移除已选文件" onClick={() => setDraftCoa(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--color-border)] hover:border-emerald-300 hover:text-emerald-600 text-xs text-[var(--color-text-secondary)]">
                            <Upload className="w-3.5 h-3.5" />
                            {draftCoa.length ? '继续选择' : '选择文件'}
                            <input type="file" multiple className="hidden" onChange={e => {
                              const files = Array.from(e.target.files || [])
                              if (files.length > 0) setDraftCoa(prev => [...prev, ...files])
                              e.target.value = ''
                            }} />
                          </label>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">厂家随批次提供的 COA 检验证书，入库后自动关联到本批次，溯源可查</p>
                        </div>
                      </div>
                    )}
                    <div className="sm:col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
                    {/* 入库日期放最后靠右，紧邻入库按钮，操作顺畅 */}
                    <div className="sm:col-start-2"><label className="block text-[var(--color-text-secondary)] mb-1">入库日期 *</label><input type="date" value={form.receiptDate} onChange={e => setForm({...form, receiptDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.rawMaterialId || !form.batchNo || !form.supplier}>
                      {editingId ? '保存修改' : '入库'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div> : items.length === 0 ? (
              <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><div className="empty-state-title">暂无库存记录</div><div className="empty-state-desc">点击右上角"入库"添加库存</div></div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead><tr className="bg-[var(--color-bg)] border-b">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">原料</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">内部批次</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">供应商批次</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">数量</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">供应商</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">入库日期</th>
                    <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                  </tr></thead>
                  <tbody>
                    {items.map((i: any) => (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={i.rawMaterial?.nameCn || '-'}>{i.rawMaterial?.nameCn || '-'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{i.internalBatch}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{i.batchNo}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{i.quantity}{i.rawMaterial?.unit || ''}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={i.supplier}>{i.supplier}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{new Date(i.receiptDate).toLocaleDateString('zh-CN')}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setCoaBatch({ id: i.id, label: `${i.rawMaterial?.nameCn || '原料'} / ${i.batchNo || i.internalBatch}` })} className="px-2 py-1 text-xs border rounded text-emerald-600 hover:bg-emerald-50" title="管理该批次 COA 报告（溯源用）">COA</button>
                            <button onClick={() => openEdit(i)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                            <button onClick={() => handleDelete(i.id)} className="px-2 py-1 text-xs border rounded text-red-500 hover:bg-red-50">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 物资库存 Tab */}
        {activeTab === 'supply' && (
          <>
            {loading ? <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div> : supplies.length === 0 ? (
              <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><div className="empty-state-title">暂无物资库存</div><div className="empty-state-desc">前往 <a href="/supply/supplies" className="text-emerald-600 underline">物资管理</a> 添加</div></div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead><tr className="bg-[var(--color-bg)] border-b">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">名称</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">分类</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">规格</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">库存</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">最低库存</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">供应商</th>
                    <th className="text-center px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                  </tr></thead>
                  <tbody>
                    {supplies.map((s: any) => {
                      const catInfo = getCategoryInfo(s.category)
                      const isLowStock = s.minStock > 0 && s.currentStock < s.minStock
                      return (
                        <tr key={s.id} className={`border-b last:border-0 hover:bg-[var(--color-bg)] ${isLowStock ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                          <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={s.name}>{s.name}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${catInfo.color}`}>{catInfo.label}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={s.specification || '-'}>{s.specification || '-'}</td>
                          <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${isLowStock ? 'text-red-600 font-bold' : ''}`}>
                            {s.currentStock}{s.unit}
                            {isLowStock && <span className="ml-1 text-xs text-red-500">⚠️</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-secondary)] whitespace-nowrap">{s.minStock > 0 ? `${s.minStock}${s.unit}` : '-'}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={s.supplier || '-'}>{s.supplier || '-'}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button onClick={() => router.push('/supply/supplies')} className="px-2 py-1 text-xs border rounded text-emerald-600 hover:bg-emerald-50">管理</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="确认删除"
        message="确定要删除此库存批次记录吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* 批次 COA 管理弹窗（随采购批次保留，溯源用） */}
      {coaBatch && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setCoaBatch(null)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">批次 COA 报告</h2>
              <button onClick={() => setCoaBatch(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] text-sm">关闭</button>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-3">
              {coaBatch.label} — 厂家随批次提供的 COA 分析证书，随批次保留供溯源查询
            </div>
            <FileUploader
              ref={coaUploaderRef}
              entityType="RawMaterialBatch"
              entityId={coaBatch.id}
              fileTypeFilter="COA"
              uploadFileType="COA"
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}
