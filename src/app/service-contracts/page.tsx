'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import ProcessTimeline from '@/components/ProcessTimeline'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const TYPES: Record<string, string> = { TRANSLATION: '翻译', LEGAL: '法务', CONSULTING: '咨询', TESTING: '检测', OTHER: '其他' }
const STATUS: Record<string, string> = {
  DRAFT: '草稿', PENDING_APPROVAL: '审批中', APPROVED: '已通过',
  REJECTED: '已驳回', ACTIVE: '履行中', COMPLETED: '已完成', TERMINATED: '已终止',
}
const COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-600',
  ACTIVE: 'bg-blue-100 text-blue-700', COMPLETED: 'bg-emerald-100 text-emerald-700',
  TERMINATED: 'bg-gray-100 text-gray-500',
}

export default function ServiceContractsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: '', method: 'BANK_TRANSFER', remark: '' })
  const [showPaymentApproval, setShowPaymentApproval] = useState(false)
  const [paymentApprovalForm, setPaymentApprovalForm] = useState({ amount: '', title: '', evidenceFiles: '' })
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const [form, setForm] = useState({
    name: '', contractor: '', type: 'OTHER', amount: '',
    signingDate: '', startDate: '', endDate: '', fileUrl: '', remark: '',
  })
  const router = useRouter()
  const { showToast } = useToast()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch('/api/service-contracts')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '加载失败')
    setItems(data.data?.contracts || data.contracts || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const fetchPayments = useCallback(async (contractId: string) => {
    setLoadingPayments(true)
    try {
      const res = await apiFetch(`/api/service-contracts/${contractId}/payments`)
      const data = await res.json()
      setPayments(data.data?.payments || data.payments || [])
    } catch { setPayments([]) }
    setLoadingPayments(false)
  }, [])

  const handleView = (c: any) => {
    setViewing(c)
    setPayments([])
    setShowPaymentForm(false)
    fetchPayments(c.id)
  }

  const handleAddPayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return
    if (!paymentForm.paymentDate) return
    // 超付校验
    const total = viewing.amount || 0
    const paid = payments.reduce((s: number, p: any) => s + p.amount, 0)
    if (paid + Number(paymentForm.amount) > total) {
      const t = await import('@/components/Toast')
      t.useToast().showToast('error', `付款金额 ¥${(paid + Number(paymentForm.amount)).toFixed(2)} 超过合同总额 ¥${total.toFixed(2)}`)
      return
    }
    try {
      const res = await apiFetch(`/api/service-contracts/${viewing.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      })
      if (res.ok) {
        setShowPaymentForm(false)
        setPaymentForm({ amount: '', paymentDate: '', method: 'BANK_TRANSFER', remark: '' })
        fetchPayments(viewing.id)
      }
    } catch {}
  }

  const handleDeletePayment = async (pid: string) => {
    if (!confirm('确定要删除此支付记录吗？')) return
    try {
      await apiFetch(`/api/service-contracts/${viewing.id}/payments/${pid}`, { method: 'DELETE' })
      fetchPayments(viewing.id)
    } catch {}
  }

  const handleSubmitPaymentApproval = async () => {
    if (!paymentApprovalForm.amount || Number(paymentApprovalForm.amount) <= 0) return
    if (!paymentApprovalForm.title) return
    setSubmittingApproval(true)
    try {
      const res = await apiFetch('/api/approval-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'Payment',
          entityId: viewing.id,
          title: paymentApprovalForm.title,
          amount: Number(paymentApprovalForm.amount),
        }),
      })
      if (res.ok) {
        setShowPaymentApproval(false)
        setPaymentApprovalForm({ amount: '', title: '', evidenceFiles: '' })
      }
    } catch {}
    setSubmittingApproval(false)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', contractor: '', type: 'OTHER', amount: '', signingDate: '', startDate: '', endDate: '', fileUrl: '', remark: '' })
    setShowForm(true)
  }

  const openEdit = (c: any) => {
    setEditingId(c.id)
    setForm({
      name: c.name || '',
      contractor: c.contractor || '',
      type: c.type || 'OTHER',
      amount: c.amount?.toString() || '',
      signingDate: c.signingDate ? c.signingDate.slice(0, 10) : '',
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
      fileUrl: c.fileUrl || '',
      remark: c.remark || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const url = editingId ? `/api/service-contracts/${editingId}` : '/api/service-contracts'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || (editingId ? '更新失败' : '创建失败'))
      return
    }
    setShowForm(false)
    setEditingId(null)
    fetchData()
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await apiFetch(`/api/service-contracts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '操作失败')
    }
    fetchData()
  }

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/service-contracts/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  const canSubmitApproval = (status: string) => status === 'DRAFT'
  const canApprove = (status: string) => status === 'PENDING_APPROVAL'
  const canEdit = (status: string) => ['DRAFT', 'REJECTED'].includes(status)

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">服务合同管理</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建服务合同</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 新建/编辑表单弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑服务合同' : '新建服务合同'}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">合同名称 *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">服务方 *</label><input type="text" value={form.contractor} onChange={e => setForm({...form, contractor: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">合同类型</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">{Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">合同金额 (¥) *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">签署日期 *</label><input type="date" value={form.signingDate} onChange={e => setForm({...form, signingDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">生效日期</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">结束日期</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div className="col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">合同文件</label>
                  <div className="flex items-center gap-3">
                    <input type="file" id="contractFile" accept=".pdf,.doc,.docx,.xlsx,.xls,image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
                        const data = await res.json()
                        if (data.url) setForm({...form, fileUrl: data.url})
                      }}
                    />
                    <button type="button" onClick={() => document.getElementById('contractFile')?.click()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">选择文件上传</button>
                    {form.fileUrl ? (
                      <span className="text-sm text-green-600 flex items-center gap-1">✓ 已上传<button onClick={() => setForm({...form, fileUrl: ''})} className="text-red-500 text-xs ml-1">移除</button></span>
                    ) : <span className="text-sm text-gray-400">支持 PDF、Word、Excel、图片</span>}
                  </div>
                  {form.fileUrl && <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">查看已上传文件</a>}
                </div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><textarea value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.name || !form.contractor || !form.amount || !form.signingDate}>{editingId ? '保存修改' : '保存'}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg><div className="empty-state-title">暂无服务合同</div><div className="empty-state-desc">点击右上角"新建服务合同"开始</div></div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">合同名称</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">服务方</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">类型</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">金额</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">状态</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={c.name}>{c.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={c.contractor}>{c.contractor}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="px-2 py-0.5 rounded text-xs bg-[var(--color-card)] text-[var(--color-text-secondary)]">{TYPES[c.type] || c.type}</span></td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">¥{c.amount?.toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[c.status] || ''}`}>{STATUS[c.status] || c.status}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button onClick={() => handleView(c)} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">查看</button>
                        {canEdit(c.status) && <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button>}
                        {canSubmitApproval(c.status) && <button onClick={() => handleStatusChange(c.id, 'PENDING_APPROVAL')} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">提交审批</button>}
                        {canApprove(c.status) && <><button onClick={() => handleStatusChange(c.id, 'APPROVED')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">通过</button><button onClick={() => handleStatusChange(c.id, 'REJECTED')} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">驳回</button></>}
                        {c.status === 'APPROVED' && <button onClick={() => handleStatusChange(c.id, 'ACTIVE')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">开始履行</button>}
                        {c.status === 'ACTIVE' && <button onClick={() => handleStatusChange(c.id, 'COMPLETED')} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">完成</button>}
                        {(c.status === 'DRAFT' || c.status === 'REJECTED') && <button onClick={() => handleDelete(c.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 查看详情弹窗（含支付管理） */}
      {viewing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setViewing(null)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">合同详情</h2>
            <div className="space-y-3 text-sm mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[var(--color-text-secondary)]">合同名称</span><p className="font-medium">{viewing.name}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">服务方</span><p className="font-medium">{viewing.contractor}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">类型</span><p>{TYPES[viewing.type] || viewing.type}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">合同金额</span><p className="font-medium">¥{viewing.amount?.toFixed(2)}</p></div>
                <div><span className="text-[var(--color-text-secondary)]">状态</span><p><span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[viewing.status] || ''}`}>{STATUS[viewing.status] || viewing.status}</span></p></div>
                <div><span className="text-[var(--color-text-secondary)]">签署日期</span><p>{viewing.signingDate ? new Date(viewing.signingDate).toLocaleDateString('zh-CN') : '-'}</p></div>
                {viewing.startDate && <div><span className="text-[var(--color-text-secondary)]">生效日期</span><p>{new Date(viewing.startDate).toLocaleDateString('zh-CN')}</p></div>}
                {viewing.endDate && <div><span className="text-[var(--color-text-secondary)]">结束日期</span><p>{new Date(viewing.endDate).toLocaleDateString('zh-CN')}</p></div>}
              </div>
              {viewing.fileUrl && <div><span className="text-[var(--color-text-secondary)]">合同文件</span><div><a href={viewing.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">查看文件</a></div></div>}
              {viewing.remark && <div><span className="text-[var(--color-text-secondary)]">备注</span><p className="whitespace-pre-wrap">{viewing.remark}</p></div>}
            </div>

            {/* 业务流程进度 */}
            <div className="border-t pt-4 mb-4">
              <ProcessTimeline
                entityType="ServiceContract"
                entityId={viewing.id}
                presetStages={[
                  { stage: 'CONTRACT_SIGNED', label: '签合同', sortOrder: 1 },
                  { stage: 'PROGRESS', label: '履行中', sortOrder: 2 },
                  { stage: 'COMPLETED', label: '已完成', sortOrder: 3 },
                ]}
              />
            </div>

            {/* 支付管理 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">支付进度</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowPaymentApproval(!showPaymentApproval)} className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700">
                    申请付款审批
                  </button>
                  <button onClick={() => setShowPaymentForm(!showPaymentForm)} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                    + 添加付款
                  </button>
                </div>
              </div>

              {/* 申请付款审批表单 */}
              {showPaymentApproval && (
                <div className="bg-amber-50 rounded-lg p-3 mb-3 grid grid-cols-2 gap-2 text-xs border border-amber-200">
                  <div className="col-span-2"><label className="block text-amber-800 mb-1">请款说明 *</label><input type="text" value={paymentApprovalForm.title} onChange={e => setPaymentApprovalForm({...paymentApprovalForm, title: e.target.value})} className="w-full px-2 py-1 border rounded" placeholder="如：第一期开发费用请款" /></div>
                  <div><label className="block text-amber-800 mb-1">请款金额(¥) *</label><input type="number" step="0.01" value={paymentApprovalForm.amount} onChange={e => setPaymentApprovalForm({...paymentApprovalForm, amount: e.target.value})} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="block text-amber-800 mb-1">请款附件</label><input type="text" value={paymentApprovalForm.evidenceFiles} onChange={e => setPaymentApprovalForm({...paymentApprovalForm, evidenceFiles: e.target.value})} className="w-full px-2 py-1 border rounded" placeholder="附件链接（选填）" /></div>
                  <div className="col-span-2 flex justify-end gap-2 mt-1">
                    <button onClick={() => { setShowPaymentApproval(false); setPaymentApprovalForm({ amount: '', title: '', evidenceFiles: '' }) }} className="px-3 py-1 text-amber-800">取消</button>
                    <button onClick={handleSubmitPaymentApproval} disabled={submittingApproval || !paymentApprovalForm.amount || !paymentApprovalForm.title} className="px-3 py-1 bg-amber-600 text-white rounded disabled:opacity-50">
                      {submittingApproval ? '提交中...' : '提交审批'}
                    </button>
                  </div>
                </div>
              )}

              {/* 进度条 */}
              {(() => {
                const total = viewing.amount || 0
                const paid = payments.reduce((s: number, p: any) => s + p.amount, 0)
                const pct = total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0
                return (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                      <span>已付 ¥{paid.toFixed(2)} / 总计 ¥{total.toFixed(2)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      未付：¥{Math.max(0, total - paid).toFixed(2)}
                    </div>
                  </div>
                )
              })()}

              {/* 添加付款表单 */}
              {showPaymentForm && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div><label className="block text-[var(--color-text-secondary)] mb-1">金额(¥) *</label><input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="block text-[var(--color-text-secondary)] mb-1">支付日期 *</label><input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="block text-[var(--color-text-secondary)] mb-1">支付方式</label><select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} className="w-full px-2 py-1 border rounded">
                    {[{v:'BANK_TRANSFER',l:'银行转账'},{v:'ALIPAY',l:'支付宝'},{v:'WECHAT',l:'微信'},{v:'CASH',l:'现金'},{v:'CHECK',l:'支票'}].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select></div>
                  <div><label className="block text-[var(--color-text-secondary)] mb-1">备注</label><input type="text" value={paymentForm.remark} onChange={e => setPaymentForm({...paymentForm, remark: e.target.value})} className="w-full px-2 py-1 border rounded" /></div>
                  <div className="col-span-2 flex justify-end gap-2 mt-1">
                    <button onClick={() => { setShowPaymentForm(false); setPaymentForm({ amount: '', paymentDate: '', method: 'BANK_TRANSFER', remark: '' }) }} className="px-3 py-1 text-[var(--color-text-secondary)]">取消</button>
                    <button onClick={handleAddPayment} className="px-3 py-1 bg-emerald-600 text-white rounded" disabled={!paymentForm.amount || !paymentForm.paymentDate}>保存</button>
                  </div>
                </div>
              )}

              {/* 支付记录列表 */}
              {loadingPayments ? (
                <div className="text-xs text-[var(--color-text-secondary)] py-2">加载中...</div>
              ) : payments.length === 0 ? (
                <div className="text-xs text-[var(--color-text-secondary)] py-2">暂无支付记录</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-emerald-700">¥{p.amount.toFixed(2)}</span>
                        <span className="text-[var(--color-text-secondary)]">{new Date(p.paymentDate).toLocaleDateString('zh-CN')}</span>
                        {p.method && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[var(--color-text-secondary)]">
                          {({BANK_TRANSFER:'转账',ALIPAY:'支付宝',WECHAT:'微信',CASH:'现金',CHECK:'支票'} as Record<string,string>)[p.method] || p.method}
                        </span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {p.remark && <span className="text-[var(--color-text-secondary)] truncate max-w-[100px]">{p.remark}</span>}
                        <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:text-red-600">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={() => setViewing(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此服务合同吗？此操作不可撤销。"
          confirmLabel="删除"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
