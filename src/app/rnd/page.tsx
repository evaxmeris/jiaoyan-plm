'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface SampleTask {
  id: string
  batchNo: string
  quantity: number
  result: string | null
  evaluation: string | null
  nextAction: string | null
  status: string
  assignedTo: string | null
  dueDate: string | null
  startedAt: string | null
  completedAt: string | null
  remark: string | null
  createdAt: string
  product: { id: string; name: string; brand: string | null; status: string } | null
}

export default function RndPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [samples, setSamples] = useState<SampleTask[]>([])
  const [showSampleForm, setShowSampleForm] = useState(false)
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [sampleForm, setSampleForm] = useState({
    productDesignId: '', batchNo: '', quantity: '100', result: '', evaluation: '', nextAction: '', status: 'PENDING', assignedTo: '', dueDate: '', remark: '',
  })
  const [editSample, setEditSample] = useState<SampleTask | null>(null)
  const [confirmDeleteSample, setConfirmDeleteSample] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(r => r.json())
      .then(d => d.user ? setUser(d.user) : router.push('/login'))
      .catch(() => router.push('/login'))
  }, [router])

  const fetchSamples = async () => {
    const res = await apiFetch('/api/rnd/samples')
    if (res.ok) {
      const data = await res.json()
      setSamples(data.data || data.samples || [])
    }
  }

  const fetchProducts = async () => {
    const res = await apiFetch('/api/rnd/products')
    if (res.ok) {
      const data = await res.json()
      setProducts((data.data || data.products || []).map((p: any) => ({ id: p.id, name: p.name })))
    }
  }

  useEffect(() => {
    fetchSamples()
    fetchProducts()
  }, [])

  const openSampleCreate = () => {
    setEditSample(null)
    setSampleForm({ productDesignId: '', batchNo: '', quantity: '100', result: '', evaluation: '', nextAction: '', status: 'PENDING', assignedTo: '', dueDate: '', remark: '' })
    setShowSampleForm(true)
  }

  const openSampleEdit = (s: SampleTask) => {
    setEditSample(s)
    setSampleForm({
      productDesignId: s.product?.id || '',
      batchNo: s.batchNo,
      quantity: s.quantity.toString(),
      result: s.result || '',
      evaluation: s.evaluation || '',
      nextAction: s.nextAction || '',
      status: s.status,
      assignedTo: s.assignedTo || '',
      dueDate: s.dueDate ? new Date(s.dueDate).toISOString().slice(0, 10) : '',
      remark: s.remark || '',
    })
    setShowSampleForm(true)
  }

  const handleSampleSubmit = async () => {
    const url = editSample ? `/api/rnd/samples/${editSample.id}` : '/api/rnd/samples'
    const method = editSample ? 'PUT' : 'POST'

    // For new samples, productDesignId is required
    if (!editSample && !sampleForm.productDesignId) {
      showToast('warning', '请选择产品')
      return
    }

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sampleForm,
        productDesignId: editSample ? undefined : sampleForm.productDesignId,
        quantity: parseInt(sampleForm.quantity) || 0,
        dueDate: sampleForm.dueDate || null,
      }),
    })
    if (res.ok) {
      setShowSampleForm(false)
      setEditSample(null)
      setSampleForm({ productDesignId: '', batchNo: '', quantity: '100', result: '', evaluation: '', nextAction: '', status: 'PENDING', assignedTo: '', dueDate: '', remark: '' })
      fetchSamples()
      fetchProducts()
    } else {
      const err = await res.json()
      showToast('error', err.error || '保存失败')
    }
  }

  const handleSampleDelete = async (id: string) => {
    setConfirmDeleteSample(id)
    const res = await apiFetch(`/api/rnd/samples/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchSamples()
    }
  }

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      PENDING: '待打样', IN_PROGRESS: '打样中', COMPLETED: '已完成', FAILED: '失败',
    }
    return labels[s] || s
  }

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-600',
      IN_PROGRESS: 'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-600',
    }
    return colors[s] || 'bg-gray-100'
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">研发管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openSampleCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建打样</button>
            <span className="text-sm text-[var(--color-text-secondary)]">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 功能卡片入口 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <a href="/rnd/materials" className="block rounded-xl border bg-[var(--color-card)] p-6 hover:shadow-md transition cursor-pointer hover:border-emerald-200">
            <h3 className="font-semibold text-lg text-emerald-700">原料库</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">INCI 原料管理 · 备案码 · CAS号 · 库存 · COA</p>
          </a>
          <a href="/rnd/formulas" className="block rounded-xl border bg-[var(--color-card)] p-6 hover:shadow-md transition cursor-pointer hover:border-emerald-200">
            <h3 className="font-semibold text-lg text-emerald-700">配方管理</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">配方创建 · 版本控制 · 原料配比 · 成本计算</p>
          </a>
          <a href="/rnd/products" className="block rounded-xl border bg-[var(--color-card)] p-6 hover:shadow-md transition cursor-pointer hover:border-emerald-200">
            <h3 className="font-semibold text-lg text-emerald-700">产品设计</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">产品档案 · 关联配方 · 包材BOM · 状态追踪</p>
          </a>
        </div>

        {/* 打样任务列表 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">打样记录</h2>
            <button onClick={openSampleCreate} className="px-3 py-1.5 text-sm border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50">+ 新建打样</button>
          </div>

          {samples.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">暂无打样记录</div>
          ) : (
            <div className="space-y-3">
              {samples.map(s => (
                <div key={s.id} className="border rounded-lg p-3 hover:shadow-sm transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.product?.name || '未知产品'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(s.status)}`}>{statusLabel(s.status)}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{s.batchNo}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1 space-x-3">
                        <span>数量: {s.quantity} 件</span>
                        {s.assignedTo && <span>负责人: {s.assignedTo}</span>}
                        {s.dueDate && <span>截止: {new Date(s.dueDate).toLocaleDateString('zh-CN')}</span>}
                        <span>创建: {new Date(s.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {/* 结果展示 */}
                      {(s.result || s.evaluation) && (
                        <div className="mt-2 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg)] rounded p-2">
                          {s.result && <div>结果: {s.result}</div>}
                          {s.evaluation && <div>评估: {s.evaluation}</div>}
                          {s.nextAction && <div>后续: {s.nextAction}</div>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => openSampleEdit(s)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                      <button onClick={() => handleSampleDelete(s.id)} className="px-2 py-1 text-xs border rounded text-red-400 hover:bg-red-50">删除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 打样表单弹窗 */}
        {showSampleForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSampleForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editSample ? '编辑打样任务' : '新建打样任务'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {!editSample && (
                  <div className="col-span-2">
                    <label className="block text-[var(--color-text-secondary)] mb-1">关联产品 *</label>
                    <select value={sampleForm.productDesignId} onChange={e => setSampleForm({...sampleForm, productDesignId: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                      <option value="">选择产品</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">批次号</label>
                  <input type="text" value={sampleForm.batchNo} onChange={e => setSampleForm({...sampleForm, batchNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="自动生成" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">数量</label>
                  <input type="number" value={sampleForm.quantity} onChange={e => setSampleForm({...sampleForm, quantity: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">状态</label>
                  <select value={sampleForm.status} onChange={e => setSampleForm({...sampleForm, status: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="PENDING">待打样</option>
                    <option value="IN_PROGRESS">打样中</option>
                    <option value="COMPLETED">已完成</option>
                    <option value="FAILED">失败</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">负责人</label>
                  <input type="text" value={sampleForm.assignedTo} onChange={e => setSampleForm({...sampleForm, assignedTo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">截止日期</label>
                  <input type="date" value={sampleForm.dueDate} onChange={e => setSampleForm({...sampleForm, dueDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">打样结果</label>
                  <input type="text" value={sampleForm.result} onChange={e => setSampleForm({...sampleForm, result: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="合格/不合格/需调整..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">评估</label>
                  <textarea value={sampleForm.evaluation} onChange={e => setSampleForm({...sampleForm, evaluation: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} placeholder="样品评估..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">后续行动</label>
                  <input type="text" value={sampleForm.nextAction} onChange={e => setSampleForm({...sampleForm, nextAction: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="放大量/调整配方/送检..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea value={sampleForm.remark} onChange={e => setSampleForm({...sampleForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowSampleForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSampleSubmit} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm" disabled={!editSample && !sampleForm.productDesignId}>
                  {editSample ? '保存修改' : '创建打样'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
