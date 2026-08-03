'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import FileUploader from '@/components/FileUploader'
import ProcessTimeline from '@/components/ProcessTimeline'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const TYPES: Record<string, string> = { INVENTION: '发明专利', UTILITY: '实用新型', DESIGN: '外观设计' }
const STATUS: Record<string, string> = {
  DRAFT: '草稿', FILING: '已提交', ACCEPTED: '已受理',
  SUBSTANTIVE: '实质审查', AUTHORIZED: '已授权',
  MAINTENANCE: '年费维护中', EXPIRED: '已失效', REJECTED: '被驳回',
}
const COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', FILING: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-cyan-100 text-cyan-700', SUBSTANTIVE: 'bg-yellow-100 text-yellow-700',
  AUTHORIZED: 'bg-green-100 text-green-700', MAINTENANCE: 'bg-emerald-100 text-emerald-700',
  EXPIRED: 'bg-gray-100 text-gray-500', REJECTED: 'bg-red-100 text-red-600',
}
const FEE_STATUS: Record<string, string> = { PENDING: '待缴费', PAID: '已缴', OVERDUE: '逾期' }
const FEE_COLORS: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', PAID: 'bg-green-100 text-green-700', OVERDUE: 'bg-red-100 text-red-600' }
const OA_STATUS: Record<string, string> = { PENDING: '待答复', RESPONDED: '已答复', CLOSED: '已结案' }

export default function PatentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showFeeForm, setShowFeeForm] = useState(false)
  const [feeForm, setFeeForm] = useState({ year: new Date().getFullYear(), amount: '', dueDate: '', paidDate: '', remark: '' })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [contracts, setContracts] = useState<any[]>([])
  const [showOAModal, setShowOAModal] = useState(false)
  const [oaForm, setOaForm] = useState({ type: '', date: '', responseDate: '', status: 'PENDING' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/api/assets/patents/${id}`)
    const json = await res.json()
    setData(json.patent)
    setAuditLogs(json.auditLogs || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])
  useEffect(() => { apiFetch("/api/service-contracts?limit=100").then(r => r.json()).then(d => setContracts(d.contracts || [])).catch(() => {}) }, [])
  const handleSave = async () => {
    await apiFetch(`/api/assets/patents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setShowEditModal(false)
    fetchData()
  }

  const handleAddFee = async () => {
    await apiFetch(`/api/assets/patents/${id}/fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: feeForm.year,
        amount: parseFloat(feeForm.amount) || 0,
        dueDate: feeForm.dueDate,
        paidDate: feeForm.paidDate || null,
        status: feeForm.paidDate ? 'PAID' : 'PENDING',
        remark: feeForm.remark || null,
      }),
    })
    setShowFeeForm(false)
    setFeeForm({ year: new Date().getFullYear(), amount: '', dueDate: '', paidDate: '', remark: '' })
    fetchData()
  }

  const handleMarkPaid = async (feeId: string) => {
    await apiFetch(`/api/assets/patents/${id}/fees?feeId=${feeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', paidDate: new Date().toISOString().split('T')[0] }),
    })
    fetchData()
  }

  const handleAddOA = async () => {
    const officeActions = data.officeActions ? [...data.officeActions] : []
    officeActions.push({
      type: oaForm.type,
      date: oaForm.date,
      responseDate: oaForm.responseDate || null,
      status: oaForm.status,
    })
    await apiFetch(`/api/assets/patents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeActions }),
    })
    setShowOAModal(false)
    setOaForm({ type: '', date: '', responseDate: '', status: 'PENDING' })
    fetchData()
  }

  const handleUpdateOAStatus = async (index: number, newStatus: string) => {
    const officeActions = [...(data.officeActions || [])]
    officeActions[index] = { ...officeActions[index], status: newStatus }
    await apiFetch(`/api/assets/patents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeActions }),
    })
    fetchData()
  }

  const handleStatusChange = async (newStatus: string) => {
    await apiFetch(`/api/assets/patents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchData()
  }

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>
  if (!data) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">专利不存在</div>

  const expireWarning = data.expireDate && new Date(data.expireDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const overdueFees = (data.fees || []).filter((f: any) => f.status === 'OVERDUE').length
  const pendingFees = (data.fees || []).filter((f: any) => f.status === 'PENDING').length
  const officeActions = data.officeActions || []

  // 生命周期时间线状态
  const lifecycleOrder = ['DRAFT', 'FILING', 'ACCEPTED', 'SUBSTANTIVE', 'AUTHORIZED', 'MAINTENANCE', 'EXPIRED']
  const currentIdx = lifecycleOrder.indexOf(data.status)

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/assets/patents')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{data.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[data.status] || ''}`}>{STATUS[data.status] || data.status}</span>
            {expireWarning && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">年费即将到期</span>}
            {overdueFees > 0 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">{overdueFees} 条年费逾期</span>}
            {pendingFees > 0 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">{pendingFees} 条待缴费</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditForm(data); setShowEditModal(true) }} className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">编辑</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 生命周期状态进度条 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">生命周期</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {lifecycleOrder.map((st, i) => {
              const isCompleted = currentIdx > i && data.status !== 'REJECTED'
              const isCurrent = st === data.status || (data.status === 'REJECTED' && i === currentIdx)
              const isRejected = data.status === 'REJECTED' && i === lifecycleOrder.indexOf('REJECTED')
              return (
                <div key={st} className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleStatusChange(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                      isRejected ? 'bg-red-100 text-red-700 border-red-300' :
                      isCurrent ? 'bg-purple-100 text-purple-700 border-purple-300 ring-2 ring-purple-200' :
                      isCompleted ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'
                    }`}
                    title={`切换到 ${STATUS[st] || st}`}
                  >
                    {isCompleted && <span className="mr-1">✓</span>}
                    {STATUS[st] || st}
                  </button>
                  {i < lifecycleOrder.length - 1 && (
                    <span className={`text-xs ${currentIdx > i ? 'text-green-400' : 'text-gray-300'}`}>→</span>
                  )}
                </div>
              )
            })}
            {data.status === 'REJECTED' && (
              <>
                <span className="text-xs text-[var(--color-text-secondary)]">→</span>
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 border border-red-300">被驳回</span>
              </>
            )}
          </div>
        </div>

        {/* 基本信息 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">基本信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-[var(--color-text-secondary)]">类型</span><p className="font-medium">{TYPES[data.type] || data.type}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">技术领域</span><p className="font-medium">{data.techField || '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">申请号</span><p className="font-medium">{data.applicationNo || '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">专利号</span><p className="font-medium">{data.patentNo || '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">发明人</span><p className="font-medium">{data.inventor}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">申请人</span><p className="font-medium">{data.applicant}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">申请日</span><p className="font-medium">{data.applyDate ? new Date(data.applyDate).toLocaleDateString('zh-CN') : '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">授权日</span><p className="font-medium">{data.grantDate ? new Date(data.grantDate).toLocaleDateString('zh-CN') : '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">年费到期</span><p className={`font-medium ${expireWarning ? 'text-red-500' : ''}`}>{data.expireDate ? new Date(data.expireDate).toLocaleDateString('zh-CN') : '-'}</p></div>
            {/* 扩展字段 */}
            <div><span className="text-[var(--color-text-secondary)]">提交日</span><p className="font-medium">{data.filingDate ? new Date(data.filingDate).toLocaleDateString('zh-CN') : '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">公开日</span><p className="font-medium">{data.publicationDate ? new Date(data.publicationDate).toLocaleDateString('zh-CN') : '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">代理机构</span><p className="font-medium">{data.agency || '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">代理人</span><p className="font-medium">{data.agentContact || '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">申请费</span><p className="font-medium">{data.fee ? `¥${data.fee.toFixed(2)}` : '-'}</p></div>
            <div className="col-span-2"><span className="text-[var(--color-text-secondary)]">备注</span><p className="font-medium">{data.remark || '-'}</p></div>
          </div>
        </div>

        {/* 受理通知书 & 专利证书 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">文件证书</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--color-bg)] rounded-lg">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">受理通知书</h3>
              {data.filingReceipt ? (
                <a href={data.filingReceipt} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1">
                  <span>📄 查看</span>
                </a>
              ) : <span className="text-sm text-[var(--color-text-secondary)]">暂未上传</span>}
            </div>
            <div className="p-4 bg-[var(--color-bg)] rounded-lg">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">专利证书</h3>
              {data.patentCert ? (
                <a href={data.patentCert} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1">
                  <span>📄 查看</span>
                </a>
              ) : <span className="text-sm text-[var(--color-text-secondary)]">暂未上传</span>}
            </div>
          </div>
        </div>

        {/* 审查意见通知书跟踪 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">审查意见通知书 ({officeActions.length})</h2>
            <button onClick={() => setShowOAModal(true)} className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200">+ 添加审查意见</button>
          </div>

          {showOAModal && (
            <div className="mb-4 p-4 bg-[var(--color-bg)] rounded-lg space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input type="text" placeholder="意见类型（如：第一次审查意见）" value={oaForm.type} onChange={e => setOaForm({...oaForm, type: e.target.value})} className="px-3 py-1.5 border rounded text-sm col-span-2" />
                <input type="date" placeholder="发文日" value={oaForm.date} onChange={e => setOaForm({...oaForm, date: e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                <input type="date" placeholder="答复截止日" value={oaForm.responseDate} onChange={e => setOaForm({...oaForm, responseDate: e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowOAModal(false)} className="px-3 py-1 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleAddOA} className="px-3 py-1 bg-orange-600 text-white rounded text-sm" disabled={!oaForm.type || !oaForm.date}>添加</button>
              </div>
            </div>
          )}

          {officeActions.length > 0 ? (
<div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">类型</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">发文日</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">答复截止日</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">状态</th>
                  <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {officeActions.map((oa: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium">{oa.type}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{oa.date ? new Date(oa.date).toLocaleDateString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{oa.responseDate ? new Date(oa.responseDate).toLocaleDateString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        oa.status === 'RESPONDED' ? 'bg-green-100 text-green-700' :
                        oa.status === 'CLOSED' ? 'bg-[var(--color-card)] text-[var(--color-text-secondary)]' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{OA_STATUS[oa.status] || oa.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {oa.status === 'PENDING' && (
                        <button onClick={() => handleUpdateOAStatus(i, 'RESPONDED')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 mr-1">已答复</button>
                      )}
                      {oa.status !== 'CLOSED' && (
                        <button onClick={() => handleUpdateOAStatus(i, 'CLOSED')} className="px-2 py-1 text-xs bg-[var(--color-card)] text-[var(--color-text-secondary)] rounded hover:bg-[var(--color-bg)]">结案</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无审查意见通知书</p>}
        </div>

        {/* 年费记录 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">年费记录 ({(data.fees || []).length})</h2>
            <button onClick={() => setShowFeeForm(true)} className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">+ 添加年费</button>
          </div>

          {showFeeForm && (
            <div className="mb-4 p-4 bg-[var(--color-bg)] rounded-lg space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <input type="number" placeholder="年份" value={feeForm.year} onChange={e => setFeeForm({...feeForm, year: parseInt(e.target.value) || new Date().getFullYear()})} className="px-3 py-1.5 border rounded text-sm" />
                <input type="number" step="0.01" placeholder="金额" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                <input type="date" placeholder="到期日" value={feeForm.dueDate} onChange={e => setFeeForm({...feeForm, dueDate: e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                <input type="date" placeholder="缴费日(可选)" value={feeForm.paidDate} onChange={e => setFeeForm({...feeForm, paidDate: e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
                <input type="text" placeholder="备注(可选)" value={feeForm.remark} onChange={e => setFeeForm({...feeForm, remark: e.target.value})} className="px-3 py-1.5 border rounded text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowFeeForm(false)} className="px-3 py-1 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleAddFee} className="px-3 py-1 bg-purple-600 text-white rounded text-sm" disabled={!feeForm.amount || !feeForm.dueDate}>添加</button>
              </div>
            </div>
          )}

          {(data.fees || []).length > 0 ? (
<div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">年度</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">金额</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">到期日</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">缴费日</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">状态</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">备注</th>
                  <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {(data.fees || []).map((fee: any) => (
                  <tr key={fee.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium">{fee.year}年</td>
                    <td className="px-4 py-3">¥{fee.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{new Date(fee.dueDate).toLocaleDateString('zh-CN')}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{fee.paidDate ? new Date(fee.paidDate).toLocaleDateString('zh-CN') : '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${FEE_COLORS[fee.status] || ''}`}>{FEE_STATUS[fee.status] || fee.status}</span></td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{fee.remark || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {fee.status === 'PENDING' && (
                        <button onClick={() => handleMarkPaid(fee.id)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">标记已缴</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无年费记录</p>}
        </div>

        {/* 附件 - 使用 FileUploader */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">附件文件</h2>
          <FileUploader entityType="Patent" entityId={data.id} />
        </div>

        {/* 审计日志 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">审计日志 ({auditLogs.length})</h2>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      log.action === 'STATUS_CHANGE' ? 'bg-orange-100 text-orange-700' :
                      log.action === 'DELETE' ? 'bg-red-100 text-red-600' :
                      'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                    }`}>{log.action}</span>
                    <span className="text-[var(--color-text-secondary)]">{log.userName || log.userId}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">{log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无审计日志</p>}
        </div>
      </main>

      {/* 编辑弹窗 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">编辑专利信息</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">专利名称</label><input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">类型</label><select value={editForm.type || 'INVENTION'} onChange={e => setEditForm({...editForm, type: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">{Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">状态</label><select value={editForm.status || 'DRAFT'} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">{Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">申请号</label><input type="text" value={editForm.applicationNo || ''} onChange={e => setEditForm({...editForm, applicationNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">专利号</label><input type="text" value={editForm.patentNo || ''} onChange={e => setEditForm({...editForm, patentNo: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">发明人</label><input type="text" value={editForm.inventor || ''} onChange={e => setEditForm({...editForm, inventor: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">申请人</label><input type="text" value={editForm.applicant || ''} onChange={e => setEditForm({...editForm, applicant: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">申请日</label><input type="date" value={editForm.applyDate ? editForm.applyDate.split('T')[0] : ''} onChange={e => setEditForm({...editForm, applyDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">提交日</label><input type="date" value={editForm.filingDate ? editForm.filingDate.split('T')[0] : ''} onChange={e => setEditForm({...editForm, filingDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">公开日</label><input type="date" value={editForm.publicationDate ? editForm.publicationDate.split('T')[0] : ''} onChange={e => setEditForm({...editForm, publicationDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">授权日</label><input type="date" value={editForm.grantDate ? editForm.grantDate.split('T')[0] : ''} onChange={e => setEditForm({...editForm, grantDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">年费到期日</label><input type="date" value={editForm.expireDate ? editForm.expireDate.split('T')[0] : ''} onChange={e => setEditForm({...editForm, expireDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">代理机构</label><input type="text" value={editForm.agency || ''} onChange={e => setEditForm({...editForm, agency: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">代理人</label><input type="text" value={editForm.agentContact || ''} onChange={e => setEditForm({...editForm, agentContact: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">关联服务合同</label>
                <select value={editForm.contractId || ""} onChange={e => setEditForm({...editForm, contractId: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm bg-[var(--color-card)]">
                  <option value="">— 不关联 —</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.name} - {c.contractor}</option>)}</select>
              </div>              <div><label className="block text-[var(--color-text-secondary)] mb-1">申请费 (¥)</label><input type="number" step="0.01" value={editForm.fee || ''} onChange={e => setEditForm({...editForm, fee: e.target.value ? parseFloat(e.target.value) : null})} className="w-full px-3 py-1.5 border rounded text-sm"/></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">受理通知书</label><div className="flex items-center gap-2"><input type="file" id="filingReceiptUpload" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;const fd=new FormData();fd.append('file',file);const res=await apiFetch('/api/upload',{method:'POST',body:fd});const data=await res.json();if(data.url)setEditForm({...editForm,filingReceipt:data.url})}}/><button type="button" onClick={()=>document.getElementById('filingReceiptUpload')?.click()} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">选择文件上传</button>{editForm.filingReceipt ? <><span className="text-xs text-green-600">✓ 已上传</span><button onClick={()=>setEditForm({...editForm,filingReceipt:''})} className="text-red-500 text-xs ml-1">移除</button><a href={editForm.filingReceipt} target="_blank" className="text-blue-500 text-xs ml-2 hover:underline">查看</a></> : null}</div></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">专利证书</label><div className="flex items-center gap-2"><input type="file" id="patentCertUpload" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;const fd=new FormData();fd.append('file',file);const res=await apiFetch('/api/upload',{method:'POST',body:fd});const data=await res.json();if(data.url)setEditForm({...editForm,patentCert:data.url})}}/><button type="button" onClick={()=>document.getElementById('patentCertUpload')?.click()} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">选择文件上传</button>{editForm.patentCert ? <><span className="text-xs text-green-600">✓ 已上传</span><button onClick={()=>setEditForm({...editForm,patentCert:''})} className="text-red-500 text-xs ml-1">移除</button><a href={editForm.patentCert} target="_blank" className="text-blue-500 text-xs ml-2 hover:underline">查看</a></> : null}</div></div>
              <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={editForm.remark || ''} onChange={e => setEditForm({...editForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2}/></div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
              <button onClick={handleSave} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
