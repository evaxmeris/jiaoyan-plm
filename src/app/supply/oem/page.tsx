'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

// 代工生产进度阶段（与详情页一致）
const OEM_STAGES = [
  'CONTRACT_SIGNED',
  'SAMPLING',
  'SAMPLE_CONFIRMED',
  'TRIAL_PRODUCTION',
  'MASS_PRODUCTION',
  'QC',
  'WAREHOUSING',
]

const STAGE_LABELS: Record<string, string> = {
  CONTRACT_SIGNED: '签合同',
  SAMPLING: '打样',
  SAMPLE_CONFIRMED: '确认',
  TRIAL_PRODUCTION: '试产',
  MASS_PRODUCTION: '量产',
  QC: 'QC',
  WAREHOUSING: '入库',
}

/** 根据里程碑数组计算进度百分比和当前阶段 */
function calcProgress(milestones: any[]) {
  if (!milestones || milestones.length === 0) return { percent: 0, currentStage: '未开始' }
  const completed = milestones.filter((m: any) => m.status === 'COMPLETED' || m.status === 'SKIPPED').length
  const percent = Math.round((completed / OEM_STAGES.length) * 100)

  // 找第一个未完成的阶段
  let currentStage = '全部完成'
  for (const stage of OEM_STAGES) {
    const m = milestones.find((x: any) => x.stage === stage)
    if (!m || m.status === 'PENDING') {
      currentStage = STAGE_LABELS[stage] || stage
      break
    }
  }
  return { percent, currentStage }
}

export default function OEMPage() {
  const [contracts, setContracts] = useState<any[]>([])
  const [milestoneMap, setMilestoneMap] = useState<Record<string, any[]>>({})
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [form, setForm] = useState({ supplierId: '', contractNo: '', productName: '', unitPrice: '', moq: '', leadTime: '', techStandard: '', startDate: '', endDate: '', remark: '' })
  const router = useRouter()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [cRes, sRes] = await Promise.all([apiFetch('/api/supply/oem'), apiFetch('/api/supply/suppliers')])
    const cData = await cRes.json()
    if (!cRes.ok) throw new Error(cData.error || '加载合同失败')
    const contractsList = cData.contracts || []
    setContracts(contractsList)
    const sData = await sRes.json()
    if (!sRes.ok) throw new Error(sData.error || '加载供应商失败')
    setSuppliers((sData.suppliers || []).filter((s: any) => s.type === 'OEM'))

    // 批量获取里程碑
    if (contractsList.length > 0) {
      try {
        const mRes = await apiFetch('/api/milestones/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: 'OEMContract',
            entityIds: contractsList.map((c: any) => c.id),
          }),
        })
        const mData = await mRes.json()
        if (mRes.ok) setMilestoneMap(mData.milestones || {})
      } catch (e) {
        console.error('获取里程碑失败', e)
      }
    } else {
      setMilestoneMap({})
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const resetForm = () => {
    setForm({ supplierId: '', contractNo: '', productName: '', unitPrice: '', moq: '', leadTime: '', techStandard: '', startDate: '', endDate: '', remark: '' })
    setEditingId(null)
  }

  const openEdit = (contract: any) => {
    setForm({
      supplierId: contract.supplierId || '',
      contractNo: contract.contractNo || '',
      productName: contract.productName || '',
      unitPrice: contract.unitPrice != null ? String(contract.unitPrice) : '',
      moq: contract.moq != null ? String(contract.moq) : '',
      leadTime: contract.leadTime != null ? String(contract.leadTime) : '',
      techStandard: contract.techStandard || '',
      startDate: contract.startDate ? contract.startDate.split('T')[0] : '',
      endDate: contract.endDate ? contract.endDate.split('T')[0] : '',
      remark: contract.remark || '',
    })
    setEditingId(contract.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (editingId) {
      await apiFetch(`/api/supply/oem/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await apiFetch('/api/supply/oem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setShowForm(false)
    resetForm()
    fetchData()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除代工合同「${name}」？删除后数据将移至回收站。`)) return
    await apiFetch(`/api/supply/oem/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { ACTIVE: 'bg-green-100 text-green-700', EXPIRED: 'bg-gray-100 text-gray-500', TERMINATED: 'bg-red-100 text-red-600' }
    const labels: Record<string, string> = { ACTIVE: '有效', EXPIRED: '已到期', TERMINATED: '已终止' }
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[s] || ''}`}>{labels[s] || s}</span>
  }

  // 计算概览数据
  const contractIds = contracts.map(c => c.id)
  const totalCount = contracts.length
  const completedCount = contracts.filter(c => {
    const ms = milestoneMap[c.id] || []
    const { percent } = calcProgress(ms)
    return percent >= 100
  }).length
  const inProgressCount = contracts.filter(c => {
    const ms = milestoneMap[c.id] || []
    const { percent } = calcProgress(ms)
    return percent > 0 && percent < 100
  }).length
  const notStartedCount = contracts.filter(c => {
    const ms = milestoneMap[c.id] || []
    const { percent } = calcProgress(ms)
    return percent === 0
  }).length

  // 待办提醒：等待确认打样 / 等待量产 的合同
  const pendingReminders = contracts.filter(c => {
    const ms = milestoneMap[c.id] || []
    // 当前阶段是"打样"意味着已签合同但还没完成打样
    const { currentStage } = calcProgress(ms)
    return currentStage === '打样' || currentStage === '确认' || currentStage === '试产'
  })

  // 按进度筛选
  let filteredContracts = contracts
  if (statusFilter === 'completed') {
    filteredContracts = contracts.filter(c => {
      const ms = milestoneMap[c.id] || []
      return calcProgress(ms).percent >= 100
    })
  } else if (statusFilter === 'in_progress') {
    filteredContracts = contracts.filter(c => {
      const ms = milestoneMap[c.id] || []
      const { percent } = calcProgress(ms)
      return percent > 0 && percent < 100
    })
  } else if (statusFilter === 'not_started') {
    filteredContracts = contracts.filter(c => {
      const ms = milestoneMap[c.id] || []
      return calcProgress(ms).percent === 0
    })
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">代工合作</h1>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建合同</button>
        </div>
      </header>
      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in space-y-4">

        {/* 概览统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">合同总数</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">{totalCount}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">未开始</div>
            <div className="text-2xl font-bold text-gray-400">{notStartedCount}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">进行中</div>
            <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">已完成</div>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </div>
        </div>

        {/* 待办提醒 */}
        {pendingReminders.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-sm font-medium text-amber-800 mb-2">
              ⚠️ 待办提醒 ({pendingReminders.length})
            </div>
            <div className="space-y-1">
              {pendingReminders.map(c => {
                const ms = milestoneMap[c.id] || []
                const { currentStage } = calcProgress(ms)
                return (
                  <div key={c.id} className="text-xs text-amber-700">
                    · <button onClick={() => router.push(`/supply/oem/${c.id}?tab=progress`)} className="underline hover:text-amber-900">
                      {c.productName}
                    </button> — 等待「{currentStage}」
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 筛选条 */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'not_started', label: '未开始' },
            { key: 'in_progress', label: '进行中' },
            { key: 'completed', label: '已完成' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                statusFilter === f.key
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-amber-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {showForm && (<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>setShowForm(false)}><div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
          <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑代工合同' : '新建代工合同'}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">代工厂 *</label><select value={form.supplierId} onChange={e=>setForm({...form,supplierId:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"><option value="">选择</option>{suppliers.map((s:any)=> <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">合同编号 *</label><input type="text" value={form.contractNo} onChange={e=>setForm({...form,contractNo:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">产品名称 *</label><input type="text" value={form.productName} onChange={e=>setForm({...form,productName:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">单价(元)</label><input type="number" value={form.unitPrice} onChange={e=>setForm({...form,unitPrice:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">起订量</label><input type="number" value={form.moq} onChange={e=>setForm({...form,moq:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">交期(天)</label><input type="number" value={form.leadTime} onChange={e=>setForm({...form,leadTime:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">技术标准</label><input type="text" value={form.techStandard} onChange={e=>setForm({...form,techStandard:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">开始日期 *</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
            <div><label className="block text-[var(--color-text-secondary)] mb-1">结束日期 *</label><input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
          </div>
          <div className="flex gap-2 mt-4 justify-end"><button onClick={()=>{setShowForm(false); resetForm()}} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button><button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.supplierId||!form.contractNo}>保存</button></div>
        </div></div>)}

        {loading ? <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div> : filteredContracts.length === 0 ? <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><div className="empty-state-title">暂无代工合同</div><div className="empty-state-desc">点击右上角"新建合同"开始</div></div> : (
          <div className="space-y-3">
            {filteredContracts.map((c: any) => {
              const ms = milestoneMap[c.id] || []
              const { percent, currentStage } = calcProgress(ms)
              return (
                <div key={c.id} className="bg-[var(--color-card)] rounded-xl border p-4 hover:border-emerald-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => router.push(`/supply/oem/${c.id}`)}>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{c.productName}</h3>
                        {statusBadge(c.status)}
                        {/* 当前进度阶段标签 */}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          percent >= 100
                            ? 'bg-green-50 text-green-700'
                            : percent > 0
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          {percent >= 100 ? '✅ 已完成' : currentStage === '全部完成' ? '已完成' : currentStage === '未开始' ? '未开始' : `▶ ${currentStage}`}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {c.contractNo} · {c.supplier?.name} · ¥{Number(c.unitPrice).toFixed(2)}/件 · MOQ {c.moq} · 交期 {c.leadTime}天
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(c.startDate).toLocaleDateString('zh-CN')} ~ {new Date(c.endDate).toLocaleDateString('zh-CN')}
                      </div>
                      {/* 进度条 */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent >= 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[var(--color-text-secondary)] w-8 text-right">{percent}%</span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/supply/oem/${c.id}`)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded" title="查看">查看</button>
                      <button onClick={() => router.push(`/supply/oem/${c.id}?tab=progress`)} className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded" title="生产进度">进度</button>
                      <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded" title="编辑">编辑</button>
                      <button onClick={() => handleDelete(c.id, c.productName)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded" title="删除">删除</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
