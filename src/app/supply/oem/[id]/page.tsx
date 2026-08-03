'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ProcessTimeline from '@/components/ProcessTimeline'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

// 代工生产进度阶段
const OEM_PRODUCTION_STAGES = [
  { stage: 'CONTRACT_SIGNED',      label: '签合同',   sortOrder: 0 },
  { stage: 'SAMPLING',             label: '打样',     sortOrder: 1 },
  { stage: 'SAMPLE_CONFIRMED',     label: '确认',     sortOrder: 2 },
  { stage: 'TRIAL_PRODUCTION',     label: '试产',     sortOrder: 3 },
  { stage: 'MASS_PRODUCTION',      label: '量产',     sortOrder: 4 },
  { stage: 'QC',                   label: 'QC',       sortOrder: 5 },
  { stage: 'WAREHOUSING',          label: '入库',     sortOrder: 6 },
]

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '有效', EXPIRED: '已到期', TERMINATED: '已终止',
}
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700', EXPIRED: 'bg-gray-100 text-gray-500', TERMINATED: 'bg-red-100 text-red-600',
}
const SCHEDULE_STATUS: Record<string, string> = {
  PLANNED: '已计划', IN_PROGRESS: '进行中', COMPLETED: '已完成', DELAYED: '已延误', CANCELLED: '已取消',
}
const SCHEDULE_COLORS: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700', DELAYED: 'bg-red-100 text-red-600', CANCELLED: 'bg-gray-100 text-gray-500',
}

type Tab = 'info' | 'prices' | 'schedules' | 'progress'

export default function OEMContractDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [contract, setContract] = useState<any>(null)
  const [prices, setPrices] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(() => {
    // 从 URL 参数中读取初始 tab
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('tab')
      if (t === 'info' || t === 'prices' || t === 'schedules' || t === 'progress') return t
    }
    return 'info'
  })

  // 报价历史表单
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [priceForm, setPriceForm] = useState({ productName: '', unitPrice: '', moq: '', effectiveDate: '', remark: '' })

  // 排产计划表单
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ productName: '', orderQty: '', plannedDate: '', remark: '' })

  const fetchContract = useCallback(async () => {
    const [cRes, pRes, sRes] = await Promise.all([
      apiFetch('/api/supply/oem'),
      apiFetch(`/api/supply/oem/${id}/prices`),
      apiFetch(`/api/supply/oem/${id}/schedules`),
    ])
    const cData = await cRes.json()
    const contracts = (cData.contracts || []).filter((c: any) => c.id === id)
    if (contracts.length > 0) setContract(contracts[0])
    const pData = await pRes.json()
    setPrices(pData.prices || [])
    const sData = await sRes.json()
    setSchedules(sData.schedules || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchContract().catch(() => {}) }, [fetchContract])

  const handleAddPrice = async () => {
    await apiFetch(`/api/supply/oem/${id}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(priceForm),
    })
    setShowPriceForm(false)
    setPriceForm({ productName: '', unitPrice: '', moq: '', effectiveDate: '', remark: '' })
    fetchContract()
  }

  const handleAddSchedule = async () => {
    await apiFetch(`/api/supply/oem/${id}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleForm),
    })
    setShowScheduleForm(false)
    setScheduleForm({ productName: '', orderQty: '', plannedDate: '', remark: '' })
    fetchContract()
  }

  const updateScheduleStatus = async (scheduleId: string, status: string, completedDate?: string) => {
    await apiFetch(`/api/supply/oem/${id}/schedules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, status, completedDate }),
    })
    fetchContract()
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div className="text-[var(--color-text-secondary)]">加载中...</div>
    </div>
  )

  if (!contract) return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div className="text-[var(--color-text-secondary)]">合同不存在</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply/oem')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{contract.productName}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[contract.status] || ''}`}>
              {STATUS_LABELS[contract.status] || contract.status}
            </span>
          </div>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="border-b bg-[var(--color-card)]">
        <div className="w-full mx-auto px-4 md:px-6 flex gap-6">
          {(['info', 'prices', 'schedules', 'progress'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-amber-600 text-amber-700' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {t === 'info' ? '合同信息' : t === 'prices' ? '报价历史' : t === 'schedules' ? '排产计划' : '生产进度'}
            </button>
          ))}
        </div>
      </div>

      <main className="w-full mx-auto px-4 md:px-6 py-6">
        {/* 合同信息 */}
        {tab === 'info' && (
          <div className="bg-[var(--color-card)] rounded-xl border p-6">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">合同编号</label>
                <div className="font-medium">{contract.contractNo}</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">代工厂</label>
                <div className="font-medium">{contract.supplier?.name || '-'}</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">产品名称</label>
                <div className="font-medium">{contract.productName}</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">技术标准</label>
                <div className="font-medium">{contract.techStandard || '-'}</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">单价</label>
                <div className="font-medium">¥{Number(contract.unitPrice).toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">起订量 (MOQ)</label>
                <div className="font-medium">{contract.moq}</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">交期</label>
                <div className="font-medium">{contract.leadTime} 天</div>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">合同期限</label>
                <div className="font-medium">
                  {new Date(contract.startDate).toLocaleDateString('zh-CN')} ~ {new Date(contract.endDate).toLocaleDateString('zh-CN')}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                <div className="font-medium">{contract.remark || '-'}</div>
              </div>
            </div>
          </div>
        )}

        {/* 报价历史 */}
        {tab === 'prices' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">报价历史</h2>
              <button onClick={() => setShowPriceForm(true)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs">+ 新增报价</button>
            </div>

            {showPriceForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPriceForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold mb-4">新增报价</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">产品名称 *</label><input type="text" value={priceForm.productName} onChange={e => setPriceForm({...priceForm, productName: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">单价(元) *</label><input type="number" value={priceForm.unitPrice} onChange={e => setPriceForm({...priceForm, unitPrice: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">MOQ</label><input type="number" value={priceForm.moq} onChange={e => setPriceForm({...priceForm, moq: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">生效日期 *</label><input type="date" value={priceForm.effectiveDate} onChange={e => setPriceForm({...priceForm, effectiveDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><input type="text" value={priceForm.remark} onChange={e => setPriceForm({...priceForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowPriceForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleAddPrice} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm" disabled={!priceForm.productName || !priceForm.unitPrice || !priceForm.effectiveDate}>保存</button>
                  </div>
                </div>
              </div>
            )}

            {prices.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)] bg-[var(--color-card)] rounded-xl border">暂无报价历史</div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[var(--color-bg)] border-b">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">产品名称</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">单价</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">MOQ</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">生效日期</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">备注</th>
                  </tr></thead>
                  <tbody>{prices.map((p: any) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                      <td className="px-4 py-3">{p.productName}</td>
                      <td className="px-4 py-3 font-medium">¥{Number(p.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.moq ?? '-'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{new Date(p.effectiveDate).toLocaleDateString('zh-CN')}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.remark || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 排产计划 */}
        {tab === 'schedules' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">排产计划</h2>
              <button onClick={() => setShowScheduleForm(true)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs">+ 新增排产</button>
            </div>

            {showScheduleForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowScheduleForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold mb-4">新增排产计划</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">产品名称 *</label><input type="text" value={scheduleForm.productName} onChange={e => setScheduleForm({...scheduleForm, productName: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">订单数量 *</label><input type="number" value={scheduleForm.orderQty} onChange={e => setScheduleForm({...scheduleForm, orderQty: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div><label className="block text-[var(--color-text-secondary)] mb-1">计划日期 *</label><input type="date" value={scheduleForm.plannedDate} onChange={e => setScheduleForm({...scheduleForm, plannedDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                    <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><input type="text" value={scheduleForm.remark} onChange={e => setScheduleForm({...scheduleForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowScheduleForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={handleAddSchedule} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm" disabled={!scheduleForm.productName || !scheduleForm.orderQty || !scheduleForm.plannedDate}>保存</button>
                  </div>
                </div>
              </div>
            )}

            {schedules.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)] bg-[var(--color-card)] rounded-xl border">暂无排产计划</div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[var(--color-bg)] border-b">
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">产品</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">数量</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">计划日期</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">完成日期</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">状态</th>
                    <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">备注</th>
                    <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                  </tr></thead>
                  <tbody>{schedules.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                      <td className="px-4 py-3">{s.productName}</td>
                      <td className="px-4 py-3">{s.orderQty}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{new Date(s.plannedDate).toLocaleDateString('zh-CN')}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{s.completedDate ? new Date(s.completedDate).toLocaleDateString('zh-CN') : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${SCHEDULE_COLORS[s.status] || ''}`}>
                          {SCHEDULE_STATUS[s.status] || s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{s.remark || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        {s.status === 'PLANNED' && <button onClick={() => updateScheduleStatus(s.id, 'IN_PROGRESS')} className="text-xs text-blue-600 hover:text-blue-800 mr-2">开始生产</button>}
                        {s.status === 'IN_PROGRESS' && (
                          <button onClick={() => updateScheduleStatus(s.id, 'COMPLETED', new Date().toISOString().split('T')[0])} className="text-xs text-green-600 hover:text-green-800">完成</button>
                        )}
                        {(s.status === 'PLANNED' || s.status === 'IN_PROGRESS') && (
                          <button onClick={() => updateScheduleStatus(s.id, 'CANCELLED')} className="text-xs text-red-500 hover:text-red-700 ml-2">取消</button>
                        )}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 生产进度跟踪 */}
        {tab === 'progress' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-[var(--color-card)] rounded-xl border overflow-hidden">
              <ProcessTimeline
                entityType="OEMContract"
                entityId={id}
                presetStages={OEM_PRODUCTION_STAGES}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
