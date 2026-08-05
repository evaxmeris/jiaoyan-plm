'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'
import SupplierInput from '@/components/SupplierInput'

const STATUS: Record<string, string> = { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回', ORDERED: '已采购', RECEIVED: '已到货', REIMBURSED: '已报销' }
const STATUS_COLORS: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-600', ORDERED: 'bg-blue-100 text-blue-700', RECEIVED: 'bg-emerald-100 text-emerald-700', REIMBURSED: 'bg-purple-100 text-purple-700' }
const URGENCY: Record<string, string> = { LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' }
const URGENCY_COLORS: Record<string, string> = { LOW: 'bg-gray-100 text-gray-500', NORMAL: 'bg-gray-100 text-[var(--color-text)]', HIGH: 'bg-orange-100 text-orange-700', URGENT: 'bg-red-100 text-red-600' }
const APPROVAL_ACTIONS: Record<string, string> = { APPROVED: '通过', REJECTED: '驳回', RETURNED: '退回修改' }
const APPROVAL_COLORS: Record<string, string> = { APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-600', RETURNED: 'bg-orange-100 text-orange-700' }

export default function PurchaseDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [approvalFlow, setApprovalFlow] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { showToast } = useToast()
  // 供应商编辑弹窗（仅 CEO）
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [supplierForm, setSupplierForm] = useState<{ name: string; supplierId: string | null }>({ name: '', supplierId: null })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/api/purchase/applications/${id}`)
    const json = await res.json()
    setData(json.data?.application || json.application)
    setAuditLogs(json.data?.auditLogs || json.auditLogs || [])
    setApprovalFlow(json.data?.approvalFlow || json.approvalFlow || null)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 审批进度与当前审批人判断
  const approvedLevels = (data?.approvals || []).filter((a: any) => a.action === 'APPROVED').length
  const stages = approvalFlow?.stages || []
  const currentStage = data?.status === 'PENDING' ? stages[approvedLevels] : null
  const isCurrentApprover = !!currentStage && !!user && (
    user.role === 'CEO'
    || (currentStage.approverId && currentStage.approverId === user.id)
    || (!currentStage.approverId && currentStage.role === user.role)
  )

  // 审批操作（通过/驳回，可附意见）
  const handleApproval = async (action: 'APPROVED' | 'REJECTED') => {
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, comment: comment.trim() || undefined }),
      })
      // 兼容非 JSON 响应（如服务器 500 HTML 页），避免误导性的解析错误提示
      const text = await res.text()
      let json: any = {}
      try { json = JSON.parse(text) } catch { json = { error: `服务器错误（HTTP ${res.status}），请稍后重试` } }
      if (!res.ok) throw new Error(json.error || '操作失败')
      setComment('')
      fetchData()
    } catch (e: any) {
      alert(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 打开供应商编辑弹窗（回填当前值）
  const openSupplierModal = () => {
    setSupplierForm({
      name: data.supplier || data.supplierR?.name || '',
      supplierId: data.supplierR?.id || null,
    })
    setShowSupplierModal(true)
  }

  // 保存供应商（仅 CEO，后端校验；自动关联档案）
  const handleSaveSupplier = async () => {
    setSavingSupplier(true)
    try {
      const res = await apiFetch(`/api/purchase/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier: supplierForm.name.trim() || null, supplierId: supplierForm.supplierId }),
      })
      const text = await res.text()
      let json: any = {}
      try { json = JSON.parse(text) } catch { json = { error: `服务器错误（HTTP ${res.status}），请稍后重试` } }
      if (!res.ok) throw new Error(json.error || '保存失败')
      const linked = json.data?.application?.supplierR
      showToast('success', linked ? `已保存，已关联档案：${linked.name}` : '已保存（未匹配到档案，仅保存名称）')
      setShowSupplierModal(false)
      fetchData()
    } catch (e: any) {
      showToast('error', e.message || '保存失败')
    } finally {
      setSavingSupplier(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>
  if (!data) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">采购申请不存在</div>

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/purchase')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{data.title}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[data.status] || ''}`}>{STATUS[data.status] || data.status}</span>
            <span className={`px-2 py-0.5 rounded text-xs ${URGENCY_COLORS[data.urgency] || ''}`}>{URGENCY[data.urgency] || data.urgency}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 基本信息 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">基本信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-[var(--color-text-secondary)]">申请编号</span><p className="font-medium">{data.code}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">申请人</span><p className="font-medium">{data.applicant?.name || '-'}</p></div>
            <div>
              <span className="text-[var(--color-text-secondary)]">供应商</span>
              <p className="font-medium flex items-center gap-2">
                {data.supplier || data.supplierR?.name || '-'}
                {user?.role === 'CEO' && (
                  <button
                    onClick={openSupplierModal}
                    className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 border border-emerald-200"
                  >
                    编辑
                  </button>
                )}
              </p>
            </div>
            <div><span className="text-[var(--color-text-secondary)]">总金额</span><p className="font-medium text-rose-600">¥{Number(data.totalAmount).toFixed(2)}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">用途说明</span><p className="font-medium">{data.purpose || '-'}</p></div>
            <div><span className="text-[var(--color-text-secondary)]">创建时间</span><p className="font-medium">{new Date(data.createdAt).toLocaleString('zh-CN')}</p></div>
          </div>
        </div>

        {/* 采购明细 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">采购明细 ({data.items?.length || 0})</h2>
          {(data.items || []).length > 0 ? (
<div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">名称</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">规格</th>
                  <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">数量</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">单位</th>
                  <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">单价</th>
                  <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">小计</th>
                  <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((item: any) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={item.name}>{item.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={item.specification || '-'}>{item.specification || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{item.quantity}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{item.unit}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">¥{Number(item.estimatedPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">¥{Number(item.totalPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] max-w-[160px] truncate" title={item.remark || '-'}>{item.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-bg)] font-medium">
                  <td colSpan={5} className="px-4 py-2 text-right text-[var(--color-text-secondary)]">合计</td>
                  <td className="px-4 py-2 text-right text-rose-600 whitespace-nowrap">¥{Number(data.totalAmount).toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无明细</p>}
        </div>

        {/* 审批操作区（仅当前审批人可见） */}
        {isCurrentApprover && data.status === 'PENDING' && (
          <div className="bg-[var(--color-card)] rounded-xl border p-6 border-emerald-200 dark:border-emerald-800">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">审批操作</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              当前第 {approvedLevels + 1} 级审批（共 {stages.length} 级）
              {currentStage?.label ? ` · ${currentStage.label}` : ''}
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="审批意见（可选）"
              rows={2}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => router.push('/purchase')}
                className="px-5 py-2 bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm hover:bg-[var(--color-bg)]"
              >
                返回
              </button>
              <button
                onClick={() => handleApproval('APPROVED')}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? '处理中...' : '确认通过'}
              </button>
              <button
                onClick={() => handleApproval('REJECTED')}
                disabled={submitting}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                驳回
              </button>
            </div>
          </div>
        )}

        {/* 审批历程 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">审批历程 ({data.approvals?.length || 0})</h2>
          {(data.approvals || []).length > 0 ? (
            <div className="relative">
              {/* 时间线 */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />
              <div className="space-y-4">
                {(data.approvals || []).map((approval: any) => (
                  <div key={approval.id} className="relative pl-10">
                    <div className={`absolute left-2.5 w-3.5 h-3.5 rounded-full border-2 ${
                      approval.action === 'APPROVED' ? 'bg-green-400 border-green-500' :
                      approval.action === 'REJECTED' ? 'bg-red-400 border-red-500' :
                      'bg-yellow-400 border-yellow-500'
                    } top-1`} />
                    <div className="bg-[var(--color-bg)] rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${APPROVAL_COLORS[approval.action] || ''}`}>{APPROVAL_ACTIONS[approval.action] || approval.action}</span>
                        <span className="text-sm font-medium">{approval.applicant?.name || '-'}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">第{approval.level}级</span>
                      </div>
                      {approval.comment && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{approval.comment}</p>}
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{new Date(approval.createdAt).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无审批记录</p>}
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

      {/* 供应商编辑弹窗（仅 CEO；输入自动联想供应商档案） */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSupplierModal(false)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">编辑供应商</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">输入名称可自动匹配供应商档案；未匹配到时仅保存名称。</p>
            <SupplierInput
              value={supplierForm.name}
              onChange={(name, supplierId) => setSupplierForm({ name, supplierId })}
              placeholder="输入供应商名称"
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" disabled={savingSupplier}>取消</button>
              <button
                onClick={handleSaveSupplier}
                disabled={savingSupplier || !supplierForm.name.trim()}
                className="px-4 py-2 text-sm rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingSupplier ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
