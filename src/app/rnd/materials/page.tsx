'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import Pagination from '@/components/Pagination'
import PageHeader from '@/components/PageHeader'
import { useList, useCreate, useUpdate, useDelete } from '@/lib/api-hooks'
import { apiFetch } from '@/lib/api-client'

interface RawMaterial {
  id: string
  nameCn: string
  nameEn: string | null
  inciName: string | null
  casNo: string | null
  备案号: string | null
  备案状态: string
  supplier: string | null
  function: string | null
  specification: string | null
  unit: string
  currentStock: number
  minStock: number
  isActive: boolean
  limitChina: string | null
  limitEu: string | null
  remark: string | null
  createdAt: string
}

const emptyForm = {
  nameCn: '', nameEn: '', inciName: '', casNo: '', filingNo: '', filingStatus: 'UNRECORDED',
  supplier: '', function: '', specification: '', unit: 'kg',
  limitChina: '', limitEu: '', remark: '',
}

export default function MaterialsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data: materials, loading, pagination, refresh: fetchMaterials } = useList<RawMaterial>(
    '/api/rnd/materials',
    { search, page: String(page) },
  )
  const { create } = useCreate('/api/rnd/materials', {
    onSuccess: () => { fetchMaterials(); showToast('success', '创建成功') },
    onError: (err) => showToast('error', err),
  })
  const { remove } = useDelete('/api/rnd/materials', {
    onSuccess: () => { fetchMaterials(); showToast('success', '删除成功') },
    onError: (err) => showToast('error', err),
  })
  const [supplierOptions, setSupplierOptions] = useState<{ id: string; name: string }[]>([])

  // 供应商下拉数据源（新建/编辑时选择已有厂家）
  useEffect(() => {
    apiFetch('/api/supply/suppliers?limit=200')
      .then(r => r.json())
      .then(json => {
        const items = json.data || json.suppliers || []
        setSupplierOptions(items.map((s: any) => ({ id: s.id, name: s.name })))
      })
      .catch(() => { /* 下拉失败不阻塞页面 */ })
  }, [])
  const [showForm, setShowForm] = useState(false)
  const [editMaterial, setEditMaterial] = useState<RawMaterial | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [viewingRegulation, setViewingRegulation] = useState<RawMaterial | null>(null)
  const [regulationData, setRegulationData] = useState<any>(null)
  const [loadingReg, setLoadingReg] = useState(false)

  const viewRegulations = async (m: RawMaterial) => {
    setViewingRegulation(m)
    setRegulationData(null)
    setLoadingReg(true)
    try {
      const res = await apiFetch(`/api/rnd/materials/${m.id}/regulations`)
      if (res.ok) setRegulationData(await res.json())
    } catch { /* ignore */ }
    setLoadingReg(false)
  }

  // 解包标准响应 {success, data:{...}}，兼容旧格式
  const regData = (regulationData as any)?.data || regulationData
  const regTotal = regData?.total ?? 0

  const marketLabels: Record<string, string> = {
    CHINA: '🇨🇳 中国', EU: '🇪🇺 欧盟', US: '🇺🇸 美国', GB: '🇬🇧 英国',
    JP: '🇯🇵 日本', KR: '🇰🇷 韩国', MY: '🇲🇾 马来西亚', PH: '🇵🇭 菲律宾',
    KSA: '🇸🇦 沙特', RU: '🇷🇺 俄罗斯',
  }
  const typeBadge = (t: string) => {
    if (t === 'PROHIBITED') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">禁用</span>
    if (t === 'RESTRICTED') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">限用</span>
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">准用</span>
  }
  const [form, setForm] = useState(emptyForm)

  const totalPages = pagination?.totalPages || 1

  const handleSubmit = async () => {
    const matched = supplierOptions.find(s => s.name === form.supplier.trim())
    const data = {
      nameCn: form.nameCn, nameEn: form.nameEn || undefined,
      inciName: form.inciName || undefined, casNo: form.casNo || undefined,
      filingNo: form.filingNo || undefined, filingStatus: form.filingStatus,
      supplier: form.supplier || undefined, supplierId: matched?.id || undefined,
      function: form.function || undefined,
      specification: form.specification || undefined, unit: form.unit || 'kg',
      limitChina: form.limitChina || undefined, limitEu: form.limitEu || undefined,
      remark: form.remark || undefined,
      isActive: true,
    }
    if (editMaterial) {
      // 编辑统一走详情页（保留此分支防御，正常流程不会到达）
      router.push(`/rnd/materials/${editMaterial.id}`)
      return
    }
    const created = await create(data)
    setShowForm(false)
    setEditMaterial(null)
    setForm(emptyForm)
    // 新建成功 → 跳转详情页补厂家资料（先建后补）
    if (created?.id) {
      router.push(`/rnd/materials/${created.id}`)
    }
  }

  const handleDelete = async (id: string) => {
    setConfirmDelete(id)
  }

  const openCreate = () => {
    setEditMaterial(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      UNRECORDED: 'bg-gray-100 text-gray-600', RECORDING: 'bg-yellow-100 text-yellow-700',
      RECORDED: 'bg-green-100 text-green-700', EXPIRED: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      UNRECORDED: '未备案', RECORDING: '备案中', RECORDED: '已备案', EXPIRED: '已过期',
    }
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || ''}`}>{labels[status] || status}</span>
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] mb-4 inline-block">&larr; 返回</button>
          <PageHeader
            title="原料库"
            action={{ label: '+ 新增原料', onClick: openCreate }}
          />
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="mb-4">
          <input type="text" placeholder="搜索原料名称 / CAS号..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm" />
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editMaterial ? '编辑原料' : '新增原料'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'INCI 中文名 *', key: 'nameCn', required: true },
                  { label: 'INCI 英文名', key: 'nameEn' }, { label: 'INCI 名(规范)', key: 'inciName' }, { label: 'CAS 号', key: 'casNo' },
                  { label: '备案码', key: 'filingNo' },
                  { label: '功能分类', key: 'function' }, { label: '规格参数', key: 'specification' },
                  { label: '单位', key: 'unit' }, { label: '中国限量', key: 'limitChina' },
                  { label: '欧盟限量', key: 'limitEu' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[var(--color-text-secondary)] mb-1">{f.label}</label>
                    <input type="text" value={(form as any)[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm" required={f.required} />
                  </div>
                ))}
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">厂家/供应商</label>
                  <input type="text" list="material-supplier-list" value={form.supplier}
                    onChange={e => setForm({ ...form, supplier: e.target.value })}
                    placeholder="选择已有厂家或输入新厂家名"
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm" />
                  <datalist id="material-supplier-list">
                    {supplierOptions.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">备案状态</label>
                  <select value={form.filingStatus}
                    onChange={e => setForm({ ...form, filingStatus: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm">
                    <option value="UNRECORDED">未备案</option>
                    <option value="RECORDING">备案中</option>
                    <option value="RECORDED">已备案</option>
                    <option value="EXPIRED">已过期</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)]">取消</button>
                <button onClick={handleSubmit} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  disabled={!form.nameCn}>{editMaterial ? '保存修改' : '保存'}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : materials.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            <div className="empty-state-title">{search ? '没有匹配的原料' : '还没有原料'}</div>
            <div className="empty-state-desc">{search ? '请尝试其他搜索关键词' : '还没有原料，点击新建第一个原料'}</div>
            {!search && <button onClick={openCreate} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建第一个原料</button>}
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">INCI 名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">CAS号</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">备案</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">功能</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">供应商</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">库存</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.nameCn}</div>
                      {m.nameEn && <div className="text-xs text-[var(--color-text-secondary)]">{m.nameEn}</div>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{m.casNo || '-'}</td>
                    <td className="px-4 py-3">{statusBadge(m['备案状态'])}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{m.function || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{m.supplier || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={m.currentStock <= m.minStock ? 'text-red-500 font-medium' : 'text-[var(--color-text-secondary)]'}>{m.currentStock}{m.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => router.push(`/rnd/materials/${m.id}`)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium mr-3">详情/资料</button>
                      <button onClick={() => viewRegulations(m)} className="text-xs text-emerald-500 hover:text-emerald-700 mr-2">法规</button>
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-red-400 hover:text-red-600">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </main>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="确认删除"
        message="确定删除该原料？"
        onConfirm={async () => {
          if (!confirmDelete) return
          await remove(confirmDelete)
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* 法规查看弹窗 */}
      {viewingRegulation && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setViewingRegulation(null)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                法规状态 — {viewingRegulation.nameCn}
                {viewingRegulation.casNo && <span className="text-xs text-gray-400 ml-2">CAS: {viewingRegulation.casNo}</span>}
              </h2>
              <button onClick={() => setViewingRegulation(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {loadingReg ? (
              <div className="text-center py-8 text-gray-400">加载中...</div>
            ) : regulationData ? (
              regTotal === 0 ? (
                <div className="text-center py-8 text-gray-400">该原料在法规库中暂无匹配记录</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(regData.byMarket as Record<string, any[]>).map(([market, items]) => (
                    <div key={market}>
                      <h3 className="text-sm font-semibold mb-2 px-1">{(marketLabels as any)[market] || market}</h3>
                      <div className="space-y-1">
                        {items.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded px-3 py-2">
                            {typeBadge(r.regulationType)}
                            <span className="text-gray-500 text-xs">{r.category || '-'}</span>
                            {r.maxConcentration && <span className="text-gray-400 text-xs">≤{r.maxConcentration}%</span>}
                            {r.restrictionNote && <span className="text-gray-500 text-xs ml-1">({r.restrictionNote})</span>}
                            <span className="text-gray-400 text-xs ml-auto">{r.sourceRegulation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-gray-400 text-center pt-2">共匹配 {regTotal} 条法规记录</div>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-red-400">加载失败，请重试</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
