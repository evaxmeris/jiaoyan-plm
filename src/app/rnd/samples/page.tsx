'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import DataTable, { Column } from './data-table'
import FormModal from './form-modal'

const PAGE_SIZE = 20
const inputCls = "w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"

// ─── Types ───
interface SampleTask { id: string; productDesignId: string; batchNo: string; quantity: number; result: string | null; evaluation: string | null; nextAction: string | null; status: string; assignedTo: string | null; dueDate: string | null; startedAt: string | null; completedAt: string | null; remark: string | null; createdAt: string; product: { id: string; name: string; brand: string | null; status: string } }
interface RetainedSample { id: string; productDesignId: string; batchNo: string; quantity: number; storageLocation: string | null; sampleDate: string; expireDate: string | null; status: string; observationRecords: any | null; remark: string | null; createdAt: string; product: { id: string; name: string; brand: string | null; status: string } }
interface StabilityTest { id: string; productDesignId: string; batchNo: string; testType: string; startDate: string; endDate: string | null; interval: number; status: string; records: any | null; remark: string | null; createdAt: string; product: { id: string; name: string; brand: string | null; status: string } }
interface Product { id: string; name: string; status: string }

// ─── Status helpers ───
const S = {
  sl: { PENDING: '待开始', IN_PROGRESS: '进行中', COMPLETED: '已完成', FAILED: '失败' },
  sc: { PENDING: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-100 text-blue-700', COMPLETED: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-600' },
  rl: { NORMAL: '正常', EXPIRING: '即将到期', EXPIRED: '已过期' },
  rc: { NORMAL: 'bg-green-100 text-green-700', EXPIRING: 'bg-yellow-100 text-yellow-700', EXPIRED: 'bg-red-100 text-red-600' },
  tl: { ACCELERATED: '加速测试', LONG_TERM: '长期测试', CHALLENGE: '挑战测试' },
  tc: { ACCELERATED: 'bg-orange-100 text-orange-700', LONG_TERM: 'bg-blue-100 text-blue-700', CHALLENGE: 'bg-purple-100 text-purple-700' },
  sl2: { IN_PROGRESS: '进行中', COMPLETED: '已完成', FAILED: '已失败' },
  sc2: { IN_PROGRESS: 'bg-blue-100 text-blue-700', COMPLETED: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-600' },
}
const ts = (s: string) => <span className="text-[var(--color-text-secondary)]">{s}</span>
const badge = (cs: Record<string, string>, ls: Record<string, string>, v: string) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${cs[v] || 'bg-gray-100 text-gray-600'}`}>{ls[v] || v}</span>
const productSelect = (v: string, onChange: (v: string) => void, products: Product[]) => (
  <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">关联产品 *</label>
  <select value={v} onChange={e => onChange(e.target.value)} className={inputCls}>
    <option value="">请选择产品</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select></div>
)

// ─── Shared hooks ───
function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => { fetch('/api/rnd/products', { credentials: 'include' }).then(r => r.json()).then(d => setProducts((d.data || d.productDesigns || d.products)?.map((p: any) => ({ id: p.id, name: p.name, status: p.status })) || [])).catch(() => {}) }, [])
  return products
}
function useTabData<T>(url: string, extract: (d: any) => T[]) {
  const { showToast } = useToast()
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const fetchData = useCallback(async () => { setLoading(true); try { const d = await(await fetch(url, { credentials: 'include' })).json(); setItems(extract(d)) } catch { showToast('error', '加载失败') } finally { setLoading(false) } }, [url, showToast])
  useEffect(() => { fetchData() }, [fetchData])
  return { items, loading, refresh: fetchData }
}

// ─── Main page ───
export default function SamplesPage() {
  const [activeTab, setActiveTab] = useState('samples')
  const router = useRouter()
  const tabs = [
    { key: 'samples', label: '打样管理' }, { key: 'retained', label: '留样管理' }, { key: 'stability', label: '稳定性跟踪' },
  ]
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b border-[var(--color-border)] sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">样品管理</h1>
          </div>
        </div>
      </header>
      <div className="border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 md:px-6">
        <nav className="flex gap-6 -mb-px">
          {tabs.map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`pb-3 pt-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-gray-300'}`}>{tab.label}</button>)}
        </nav>
      </div>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {activeTab === 'samples' && <SampleTaskTab />}
        {activeTab === 'retained' && <RetainedSampleTab />}
        {activeTab === 'stability' && <StabilityTestTab />}
      </main>
    </div>
  )
}

// ─── Tab helpers ───
function useFilter<T extends { batchNo: string; product?: { name?: string | null } }>(items: T[]) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const filtered = items.filter(i => i.batchNo.toLowerCase().includes(search.toLowerCase()) || i.product?.name?.toLowerCase().includes(search.toLowerCase()))
  return { search, setSearch, page, setPage, filtered, paged: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) }
}

// ─── 打样管理 Tab ───
function SampleTaskTab() {
  const { showToast } = useToast()
  const { items, loading, refresh } = useTabData<SampleTask>('/api/rnd/samples', d => d.samples || [])
  const products = useProducts()
  const { search, setSearch, page, setPage, filtered, paged } = useFilter(items)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<SampleTask | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [f, setF] = useState({ productDesignId: '', batchNo: '', quantity: '0', status: 'PENDING', assignedTo: '', dueDate: '', remark: '' })
  const emptyF = () => setF({ productDesignId: '', batchNo: '', quantity: '0', status: 'PENDING', assignedTo: '', dueDate: '', remark: '' })
  const fillF = (item: SampleTask) => setF({ productDesignId: item.productDesignId, batchNo: item.batchNo, quantity: String(item.quantity), status: item.status, assignedTo: item.assignedTo || '', dueDate: item.dueDate?.slice(0, 10) || '', remark: item.remark || '' })
  const save = async () => { const url = editItem ? `/api/rnd/samples/${editItem.id}` : '/api/rnd/samples'; const r = await fetch(url, { method: editItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); if (r.ok) { showToast('success', editItem ? '更新成功' : '创建成功'); setShowForm(false); refresh() } else { const d = await r.json(); showToast('error', d.error || '操作失败') } }
  const del = async () => { if (!confirmDelete) return; const r = await fetch(`/api/rnd/samples/${confirmDelete}`, { method: 'DELETE' }); if (r.ok) { showToast('success', '删除成功'); setConfirmDelete(null); refresh() } else showToast('error', '删除失败') }

  const cols: Column<SampleTask>[] = [
    { key: 'p', label: '产品', render: i => <div className="font-medium text-[var(--color-text)]">{i.product?.name || '-'}</div> },
    { key: 'b', label: '批次号', render: i => ts(i.batchNo) },
    { key: 'q', label: '数量', render: i => ts(String(i.quantity)) },
    { key: 's', label: '状态', render: i => badge(S.sc, S.sl, i.status) },
    { key: 'a', label: '负责人', render: i => ts(i.assignedTo || '-') },
    { key: 'd', label: '截止日期', render: i => ts(i.dueDate ? i.dueDate.slice(0, 10) : '-') },
    { key: 'r', label: '备注', render: i => <span className="text-[var(--color-text-secondary)] max-w-[150px] inline-block truncate">{i.remark || '-'}</span> },
    { key: 'x', label: '操作', className: 'text-right', render: i => <><button onClick={() => { fillF(i); setEditItem(i); setShowForm(true) }} className="text-emerald-600 hover:text-emerald-800 mr-3">编辑</button><button onClick={() => setConfirmDelete(i.id)} className="text-red-500 hover:text-red-700">删除</button></> },
  ]
  return (<>
    <DataTable columns={cols} data={paged} loading={loading} search={search} onSearchChange={setSearch}
      searchPlaceholder="搜索批次号/产品名..." totalCount={filtered.length}
      page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage}
      onCreateLabel="新建打样" onCreate={() => { setEditItem(null); emptyF(); setShowForm(true) }} emptyMessage="暂无打样任务" />
    <FormModal open={showForm} title={editItem ? '编辑打样任务' : '新建打样任务'} onClose={() => setShowForm(false)} onSave={save} saveLabel={editItem ? '保存修改' : '创建'}>
      {productSelect(f.productDesignId, v => setF(p => ({ ...p, productDesignId: v })), products)}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">批次号</label><input type="text" value={f.batchNo} onChange={e => setF(p => ({ ...p, batchNo: e.target.value }))} placeholder="自动生成或手动输入" className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">数量</label><input type="number" value={f.quantity} onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">状态</label><select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} className={inputCls}>
          <option value="PENDING">待开始</option><option value="IN_PROGRESS">进行中</option><option value="COMPLETED">已完成</option><option value="FAILED">失败</option>
        </select></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">负责人</label><input type="text" value={f.assignedTo} onChange={e => setF(p => ({ ...p, assignedTo: e.target.value }))} className={inputCls} /></div>
      </div>
      <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">截止日期</label><input type="date" value={f.dueDate} onChange={e => setF(p => ({ ...p, dueDate: e.target.value }))} className={inputCls} /></div>
      <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">备注</label><textarea value={f.remark} onChange={e => setF(p => ({ ...p, remark: e.target.value }))} rows={3} className={inputCls} /></div>
    </FormModal>
    <ConfirmDialog open={confirmDelete !== null} title="确认删除" message="确定删除此打样任务？" onConfirm={del} onCancel={() => setConfirmDelete(null)} />
  </>)
}

// ─── 留样管理 Tab ───
function RetainedSampleTab() {
  const { showToast } = useToast()
  const { items, loading, refresh } = useTabData<RetainedSample>('/api/rnd/retained-samples', d => d.samples || [])
  const products = useProducts()
  const enriched = items.map(i => {
    let ds = i.status
    if (i.expireDate) { const days = Math.ceil((new Date(i.expireDate).getTime() - Date.now()) / 86400000); if (days <= 0) ds = 'EXPIRED'; else if (days <= 30) ds = 'EXPIRING' }
    return { ...i, displayStatus: ds }
  })
  const { search, setSearch, page, setPage, filtered, paged } = useFilter(enriched)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<RetainedSample | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [f, setF] = useState({ productDesignId: '', batchNo: '', quantity: '0', storageLocation: '', sampleDate: new Date().toISOString().slice(0, 10), expireDate: '', status: 'NORMAL', remark: '' })
  const emptyF = () => setF({ productDesignId: '', batchNo: '', quantity: '0', storageLocation: '', sampleDate: new Date().toISOString().slice(0, 10), expireDate: '', status: 'NORMAL', remark: '' })
  const fillF = (item: RetainedSample) => setF({ productDesignId: item.productDesignId, batchNo: item.batchNo, quantity: String(item.quantity), storageLocation: item.storageLocation || '', sampleDate: item.sampleDate.slice(0, 10), expireDate: item.expireDate?.slice(0, 10) || '', status: item.status, remark: item.remark || '' })
  const save = async () => { const url = editItem ? `/api/rnd/retained-samples/${editItem.id}` : '/api/rnd/retained-samples'; const r = await fetch(url, { method: editItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); if (r.ok) { showToast('success', editItem ? '更新成功' : '创建成功'); setShowForm(false); refresh() } else { const d = await r.json(); showToast('error', d.error || '操作失败') } }
  const del = async () => { if (!confirmDelete) return; const r = await fetch(`/api/rnd/retained-samples/${confirmDelete}`, { method: 'DELETE' }); if (r.ok) { showToast('success', '删除成功'); setConfirmDelete(null); refresh() } else showToast('error', '删除失败') }

  const cols: Column<RetainedSample & { displayStatus?: string }>[] = [
    { key: 'p', label: '产品', render: i => <div className="font-medium text-[var(--color-text)]">{i.product?.name || '-'}</div> },
    { key: 'b', label: '批次号', render: i => ts(i.batchNo) },
    { key: 'q', label: '数量', render: i => ts(String(i.quantity)) },
    { key: 'l', label: '留样位置', render: i => ts(i.storageLocation || '-') },
    { key: 'sd', label: '留样日期', render: i => ts(i.sampleDate?.slice(0, 10) || '') },
    { key: 'ed', label: '到期日', render: i => { if (!i.expireDate) return ts('-'); const c = i.displayStatus === 'EXPIRED' ? 'text-red-600 font-medium' : i.displayStatus === 'EXPIRING' ? 'text-yellow-600 font-medium' : 'text-[var(--color-text-secondary)]'; return <span className={c}>{i.expireDate?.slice(0, 10)}</span> } },
    { key: 'st', label: '状态', render: i => badge(S.rc, S.rl, i.displayStatus || i.status) },
    { key: 'x', label: '操作', className: 'text-right', render: i => <><button onClick={() => { fillF(i); setEditItem(i); setShowForm(true) }} className="text-emerald-600 hover:text-emerald-800 mr-3">编辑</button><button onClick={() => setConfirmDelete(i.id)} className="text-red-500 hover:text-red-700">删除</button></> },
  ]
  return (<>
    <DataTable columns={cols} data={paged} loading={loading} search={search} onSearchChange={setSearch}
      searchPlaceholder="搜索批次号/产品名..." totalCount={filtered.length}
      page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage}
      onCreateLabel="新建留样" onCreate={() => { setEditItem(null); emptyF(); setShowForm(true) }} emptyMessage="暂无留样记录" />
    <FormModal open={showForm} title={editItem ? '编辑留样记录' : '新建留样记录'} onClose={() => setShowForm(false)} onSave={save}>
      {productSelect(f.productDesignId, v => setF(p => ({ ...p, productDesignId: v })), products)}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">批次号 *</label><input type="text" value={f.batchNo} onChange={e => setF(p => ({ ...p, batchNo: e.target.value }))} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">数量 *</label><input type="number" value={f.quantity} onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} className={inputCls} /></div>
      </div>
      <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">留样位置</label><input type="text" value={f.storageLocation} onChange={e => setF(p => ({ ...p, storageLocation: e.target.value }))} placeholder="例如：留样室A-3-2" className={inputCls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">留样日期 *</label><input type="date" value={f.sampleDate} onChange={e => setF(p => ({ ...p, sampleDate: e.target.value }))} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">保质期</label><input type="date" value={f.expireDate} onChange={e => setF(p => ({ ...p, expireDate: e.target.value }))} className={inputCls} /></div>
      </div>
      <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">备注</label><textarea value={f.remark} onChange={e => setF(p => ({ ...p, remark: e.target.value }))} rows={3} className={inputCls} /></div>
    </FormModal>
    <ConfirmDialog open={confirmDelete !== null} title="确认删除" message="确定删除此留样记录？" onConfirm={del} onCancel={() => setConfirmDelete(null)} />
  </>)
}

// ─── 稳定性跟踪 Tab ───
function StabilityTestTab() {
  const { showToast } = useToast()
  const { items, loading, refresh } = useTabData<StabilityTest>('/api/rnd/stability-tests', d => d.tests || [])
  const products = useProducts()
  const { search, setSearch, page, setPage, filtered, paged } = useFilter(items)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<StabilityTest | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState<StabilityTest | null>(null)
  const [f, setF] = useState({ productDesignId: '', batchNo: '', testType: 'ACCELERATED', startDate: new Date().toISOString().slice(0, 10), endDate: '', interval: '1', status: 'IN_PROGRESS', remark: '' })
  const emptyF = () => setF({ productDesignId: '', batchNo: '', testType: 'ACCELERATED', startDate: new Date().toISOString().slice(0, 10), endDate: '', interval: '1', status: 'IN_PROGRESS', remark: '' })
  const fillF = (item: StabilityTest) => setF({ productDesignId: item.productDesignId, batchNo: item.batchNo, testType: item.testType, startDate: item.startDate.slice(0, 10), endDate: item.endDate?.slice(0, 10) || '', interval: String(item.interval), status: item.status, remark: item.remark || '' })
  const save = async () => { const url = editItem ? `/api/rnd/stability-tests/${editItem.id}` : '/api/rnd/stability-tests'; const r = await fetch(url, { method: editItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); if (r.ok) { showToast('success', editItem ? '更新成功' : '创建成功'); setShowForm(false); refresh() } else { const d = await r.json(); showToast('error', d.error || '操作失败') } }
  const del = async () => { if (!confirmDelete) return; const r = await fetch(`/api/rnd/stability-tests/${confirmDelete}`, { method: 'DELETE' }); if (r.ok) { showToast('success', '删除成功'); setConfirmDelete(null); refresh() } else showToast('error', '删除失败') }
  const getMonths = (t: StabilityTest) => Math.max(1, Math.ceil(((t.endDate ? new Date(t.endDate) : new Date()).getTime() - new Date(t.startDate).getTime()) / 2592000000))

  const cols: Column<StabilityTest>[] = [
    { key: 'p', label: '产品', render: i => <div className="font-medium text-[var(--color-text)]">{i.product?.name || '-'}</div> },
    { key: 'b', label: '批次号', render: i => ts(i.batchNo) },
    { key: 't', label: '测试类型', render: i => badge(S.tc, S.tl, i.testType) },
    { key: 'sd', label: '开始日期', render: i => ts(i.startDate?.slice(0, 10) || '') },
    { key: 'ed', label: '预计完成', render: i => ts(i.endDate ? i.endDate.slice(0, 10) : '-') },
    { key: 'i', label: '间隔(月)', render: i => ts(`${i.interval}月`) },
    { key: 's', label: '状态', render: i => badge(S.sc2, S.sl2, i.status) },
    { key: 'x', label: '操作', className: 'text-right', render: i => <><button onClick={() => setShowDetail(i)} className="text-blue-600 hover:text-blue-800 mr-3">详情</button><button onClick={() => { fillF(i); setEditItem(i); setShowForm(true) }} className="text-emerald-600 hover:text-emerald-800 mr-3">编辑</button><button onClick={() => setConfirmDelete(i.id)} className="text-red-500 hover:text-red-700">删除</button></> },
  ]
  return (<>
    <DataTable columns={cols} data={paged} loading={loading} search={search} onSearchChange={setSearch}
      searchPlaceholder="搜索批次号/产品名..." totalCount={filtered.length}
      page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage}
      onCreateLabel="新建稳定性测试" onCreate={() => { setEditItem(null); emptyF(); setShowForm(true) }} emptyMessage="暂无稳定性测试" />

    {showDetail && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowDetail(null)}>
        <div className="bg-[var(--color-card)] rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">稳定性测试详情</h3>
            <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><span className="text-sm text-[var(--color-text-secondary)]">产品：</span><span className="text-sm text-[var(--color-text)]">{showDetail.product?.name}</span></div>
              <div><span className="text-sm text-[var(--color-text-secondary)]">批次：</span><span className="text-sm text-[var(--color-text)]">{showDetail.batchNo}</span></div>
              <div><span className="text-sm text-[var(--color-text-secondary)]">测试类型：</span>{badge(S.tc, S.tl, showDetail.testType)}</div>
              <div><span className="text-sm text-[var(--color-text-secondary)]">状态：</span>{badge(S.sc2, S.sl2, showDetail.status)}</div>
              <div><span className="text-sm text-[var(--color-text-secondary)]">开始日期：</span><span className="text-sm text-[var(--color-text)]">{showDetail.startDate?.slice(0, 10)}</span></div>
              <div><span className="text-sm text-[var(--color-text-secondary)]">预计完成：</span><span className="text-sm text-[var(--color-text)]">{showDetail.endDate ? showDetail.endDate.slice(0, 10) : '-'}</span></div>
              <div><span className="text-sm text-[var(--color-text-secondary)]">观察间隔：</span><span className="text-sm text-[var(--color-text)]">{showDetail.interval} 月/次</span></div>
            </div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">观察时间线</h4>
            <div className="space-y-3">
              {(() => {
                const records = showDetail.records as Array<{ month: number; date: string; result: string; description?: string; images?: string[] }> | null
                const total = getMonths(showDetail)
                return total <= 0 ? <p className="text-sm text-[var(--color-text-secondary)]">暂无观察记录</p> : Array.from({ length: Math.floor(total / showDetail.interval) + 1 }, (_, i) => i * showDetail.interval).map(m => {
                  const rec = records?.find(r => r.month === m)
                  return (<div key={m} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 ${rec ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`} />
                      {m < total && <div className="w-0.5 h-8 bg-gray-200" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="text-sm font-medium text-[var(--color-text)]">第 {m} 个月</div>
                      {rec ? (<div className="mt-1 text-sm">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${rec.result === 'NORMAL' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{rec.result === 'NORMAL' ? '正常' : rec.result}</span>
                        {rec.description && <p className="mt-1 text-[var(--color-text-secondary)]">{rec.description}</p>}
                      </div>) : <div className="mt-1 text-sm text-[var(--color-text-secondary)]">待观察</div>}
                    </div>
                  </div>)
                })
              })()}
            </div>
            {showDetail.remark && <div className="mt-4 p-3 bg-[var(--color-bg)] rounded-lg"><span className="text-sm text-[var(--color-text-secondary)]">备注：</span><span className="text-sm text-[var(--color-text)]">{showDetail.remark}</span></div>}
          </div>
          <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end">
            <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">关闭</button>
          </div>
        </div>
      </div>
    )}

    <FormModal open={showForm} title={editItem ? '编辑稳定性测试' : '新建稳定性测试'} onClose={() => setShowForm(false)} onSave={save} saveLabel={editItem ? '保存修改' : '创建'}>
      {productSelect(f.productDesignId, v => setF(p => ({ ...p, productDesignId: v })), products)}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">批次号 *</label><input type="text" value={f.batchNo} onChange={e => setF(p => ({ ...p, batchNo: e.target.value }))} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">测试类型</label><select value={f.testType} onChange={e => setF(p => ({ ...p, testType: e.target.value }))} className={inputCls}>
          <option value="ACCELERATED">加速测试</option><option value="LONG_TERM">长期测试</option><option value="CHALLENGE">挑战测试</option>
        </select></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">开始日期</label><input type="date" value={f.startDate} onChange={e => setF(p => ({ ...p, startDate: e.target.value }))} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">预计完成</label><input type="date" value={f.endDate} onChange={e => setF(p => ({ ...p, endDate: e.target.value }))} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">间隔(月)</label><input type="number" value={f.interval} onChange={e => setF(p => ({ ...p, interval: e.target.value }))} className={inputCls} /></div>
      </div>
      <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1">备注</label><textarea value={f.remark} onChange={e => setF(p => ({ ...p, remark: e.target.value }))} rows={3} className={inputCls} /></div>
    </FormModal>
    <ConfirmDialog open={confirmDelete !== null} title="确认删除" message="确定删除此稳定性测试？" onConfirm={del} onCancel={() => setConfirmDelete(null)} />
  </>)
}
