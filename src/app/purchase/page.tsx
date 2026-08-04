'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface PurchaseApp {
  id: string
  code: string
  title: string
  totalAmount: number
  status: string
  urgency: string
  category: string
  purpose: string
  supplier: string | null
  applicant: { name: string }
  items: { id: string; name: string; quantity: number; unit: string }[]
  approvals: { id: string; action: string; level: number; applicant: { name: string } }[]
  createdAt: string
  purchaseOrder?: { id: string; poNo: string; status: string } | null
}

interface ApprovalStage {
  level: number
  role: string
  approverId?: string
  approverName?: string
  label: string
  condition: string
}

interface ApprovalFlow {
  id: string
  name: string
  stages: ApprovalStage[]
}

interface BudgetInfo {
  id: string
  department: string
  fiscalYear: number
  totalAmount: number
  usedAmount: number
}

// 采购分类
const CATEGORY_LABELS: Record<string, string> = {
  RAW_MATERIAL: '原料采购',
  PACKAGING: '包材采购',
  LAB_SUPPLIES: '实验用品',
  EQUIPMENT: '生产设备',
  OFFICE_SUPPLIES: '办公物资',
  GIFTS: '节日礼品',
  OTHER: '其他',
}

const CATEGORY_COLORS: Record<string, string> = {
  RAW_MATERIAL: 'bg-rose-100 text-rose-700',
  PACKAGING: 'bg-teal-100 text-teal-700',
  LAB_SUPPLIES: 'bg-blue-100 text-blue-700',
  EQUIPMENT: 'bg-purple-100 text-purple-700',
  OFFICE_SUPPLIES: 'bg-gray-100 text-gray-700',
  GIFTS: 'bg-pink-100 text-pink-700',
  OTHER: 'bg-orange-100 text-orange-700',
}

// 角色中文显示
const ROLE_LABELS: Record<string, string> = {
  CEO: '总经理',
  RND_MANAGER: '研发主管',
  DEVELOPER: '研发人员',
  COMPLIANCE: '合规专员',
  PURCHASER: '采购专员',
  FINANCE: '财务',
  PRODUCTION: '生产',
  OBSERVER: '观察者',
}

// 条件匹配函数
function evaluateCondition(condition: string, amount: number): boolean {
  if (!condition) return true
  const match = condition.match(/^amount\s*(<=|>=|<|>|=)\s*(\d+)$/)
  if (!match) return true
  const [, op, val] = match
  const threshold = parseInt(val, 10)
  switch (op) {
    case '<=': return amount <= threshold
    case '>=': return amount >= threshold
    case '<': return amount < threshold
    case '>': return amount > threshold
    case '=': return amount === threshold
    default: return true
  }
}

export default function PurchasePage() {
  const [apps, setApps] = useState<PurchaseApp[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', supplier: '', purpose: '', urgency: 'NORMAL', category: 'RAW_MATERIAL' })
  const [formItems, setFormItems] = useState<{ name: string; specification: string; quantity: string; unit: string; estimatedPrice: string; rawMaterialId: string }[]>([])
  const [budget, setBudget] = useState<BudgetInfo | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [rawMaterials, setRawMaterials] = useState<{ id: string; nameCn: string; unit: string }[]>([])
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [appsRes, budgetRes] = await Promise.all([
      apiFetch('/api/purchase/applications'),
      apiFetch('/api/finance/budget'),
    ])
    const appsData = await appsRes.json()
    if (!appsRes.ok) throw new Error(appsData.error || '加载申请失败')
    const budgetData = await budgetRes.json()
    if (!budgetRes.ok) throw new Error(budgetData.error || '加载预算失败')
    setApps(appsData.applications || [])
    setApprovalFlow(appsData.approvalFlow || null)
    if (budgetData.budgets && budgetData.budgets.length > 0) {
      setBudget((budgetData.data?.budgets || budgetData.budgets || [])[0])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) {
      setUserRole(user.role)
      setUserName(user.name || '')
      setUserId(user.id || '')
    }
    fetchData()
  }, [fetchData, user])

  // 获取某申请的匹配审批阶段
  const getMatchingStages = (app: PurchaseApp): ApprovalStage[] => {
    if (!approvalFlow) return []
    const stages = approvalFlow.stages
      .filter((s: ApprovalStage) => evaluateCondition(s.condition, Number(app.totalAmount)))
      .sort((a: ApprovalStage, b: ApprovalStage) => a.level - b.level)
    return stages
  }

  // 获取审批进度
  const getApprovalProgress = (app: PurchaseApp) => {
    const stages = getMatchingStages(app)
    if (stages.length === 0) return null

    const approvedLevels = (app.approvals || []).filter(a => a.action === 'APPROVED').length
    const totalLevels = stages.length
    const isComplete = approvedLevels >= totalLevels
    const currentStage = !isComplete ? stages[approvedLevels] : null

    return { approvedLevels, totalLevels, isComplete, currentStage }
  }

  // 判断当前用户是否能审批当前申请
  const canCurrentUserApprove = (app: PurchaseApp): boolean => {
    if (!userRole) return false
    const progress = getApprovalProgress(app)
    if (!progress || progress.isComplete) return false
    const stage = progress.currentStage
    if (!stage) return false
    // CEO 可以审批任何级别
    if (userRole === 'CEO') return true
    // approverId 优先匹配
    if (stage.approverId) {
      return stage.approverId === userId
    }
    // role 兜底
    return userRole === stage.role
  }

  const handleCreate = async () => {
    const items = formItems.map(i => ({
      name: i.name,
      specification: i.specification,
      quantity: parseFloat(i.quantity) || 0,
      unit: i.unit || '个',
      estimatedPrice: parseFloat(i.estimatedPrice) || 0,
      rawMaterialId: i.rawMaterialId || undefined,
    }))
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.estimatedPrice, 0)

    const res = await apiFetch('/api/purchase/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items, totalAmount }),
    })

    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '创建失败')
      return
    }

    setShowForm(false)
    setForm({ title: '', supplier: '', purpose: '', urgency: 'NORMAL', category: 'RAW_MATERIAL' })
    setFormItems([])
    fetchData()
  }

  const handleGeneratePO = async (applicationId: string) => {
    const res = await apiFetch('/api/purchase/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId }),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '生成PO失败')
      return
    }
    showToast('success', '采购订单已生成')
    fetchData()
  }

  const handleStatus = async (id: string, status: string) => {
    const res = await apiFetch(`/api/purchase/applications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '操作失败')
    }
    setConfirmId(null)
    setConfirmAction(null)
    fetchData()
  }

  // 确认弹窗
  const showConfirm = (id: string, action: string) => {
    setConfirmId(id)
    setConfirmAction(action)
  }

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回', ORDERED: '已采购', RECEIVED: '已到货', REIMBURSED: '已报销' }
    return labels[s] || s
  }
  const statusColor = (s: string) => {
    const colors: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-600', ORDERED: 'bg-blue-100 text-blue-700', RECEIVED: 'bg-emerald-100 text-emerald-700', REIMBURSED: 'bg-purple-100 text-purple-700' }
    return colors[s] || ''
  }
  const urgencyBadge = (u: string) => {
    const colors: Record<string, string> = { LOW: 'bg-gray-100 text-gray-500', NORMAL: 'bg-gray-100 text-[var(--color-text)]', HIGH: 'bg-orange-100 text-orange-700', URGENT: 'bg-red-100 text-red-600' }
    return <span className={`px-2 py-0.5 rounded text-xs ${colors[u] || ''}`}>{u === 'URGENT' ? '紧急' : u === 'HIGH' ? '高' : u === 'NORMAL' ? '普通' : '低'}</span>
  }

  // 预算进度条计算
  const budgetPercent = budget && Number(budget.totalAmount) > 0
    ? Math.min(100, Math.round((Number(budget.usedAmount) / Number(budget.totalAmount)) * 100))
    : 0
  const budgetColor = budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 75 ? 'bg-orange-500' : 'bg-rose-500'

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">采购审批</h1>
          </div>
          <button onClick={async () => {
            setShowForm(true)
            try {
              const res = await apiFetch('/api/rnd/materials')
              const json = await res.json()
              setRawMaterials(json.rawMaterials || json.materials || [])
            } catch {}
          }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建采购申请</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 预算使用进度条 */}
        {budget && (
          <div className="bg-[var(--color-card)] rounded-xl border p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                预算概览 · {budget.department}
                <span className="text-xs text-[var(--color-text-secondary)] ml-2">{budget.fiscalYear} 年度</span>
              </h3>
              <span className="text-xs text-[var(--color-text-secondary)]">
                ¥{Number(budget.usedAmount).toFixed(2)} / ¥{Number(budget.totalAmount).toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-[var(--color-border)] rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${budgetColor}`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            {budgetPercent >= 90 && (
              <p className="text-xs text-red-500 mt-1">⚠ 预算即将用完（{budgetPercent}%）</p>
            )}
          </div>
        )}

        {/* 新建表单（保持不变） */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">新建采购申请</h2>
              {budget && (
                <div className="mb-4 p-3 bg-rose-50 rounded-lg border border-rose-100 text-sm">
                  <div className="flex items-center justify-between text-xs text-rose-700 mb-1">
                    <span>预算剩余</span>
                    <span>¥{Number(Math.max(0, Number(budget.totalAmount) - Number(budget.usedAmount))).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-rose-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${budgetColor}`} style={{ width: `${budgetPercent}%` }} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">采购标题 *</label><input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">采购分类</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">供应商</label><input type="text" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">紧急程度</label><select value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option><option value="URGENT">紧急</option></select></div>
                <div className="col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">用途说明</label><textarea value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">采购物品</h3>
              <div className="space-y-2 mb-3">
                {formItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center text-xs">
                    <select value={item.rawMaterialId} onChange={e => {
                      const items = [...formItems]
                      const rmId = e.target.value
                      items[i].rawMaterialId = rmId
                      if (rmId) {
                        const rm = rawMaterials.find(m => m.id === rmId)
                        if (rm) {
                          items[i].name = rm.nameCn
                          items[i].unit = rm.unit
                        }
                      }
                      setFormItems(items)
                    }} className="w-28 px-2 py-1.5 border rounded text-xs">
                      <option value="">原料...</option>
                      {rawMaterials.map(rm => (
                        <option key={rm.id} value={rm.id}>{rm.nameCn}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="名称" value={item.name} onChange={e => { const items = [...formItems]; items[i].name = e.target.value; setFormItems(items) }} className="flex-1 px-2 py-1.5 border rounded" />
                    <input type="number" placeholder="数量" value={item.quantity} onChange={e => { const items = [...formItems]; items[i].quantity = e.target.value; setFormItems(items) }} className="w-16 px-2 py-1.5 border rounded text-right" />
                    <input type="text" placeholder="单位" value={item.unit} onChange={e => { const items = [...formItems]; items[i].unit = e.target.value; setFormItems(items) }} className="w-12 px-2 py-1.5 border rounded" />
                    <input type="number" placeholder="单价" value={item.estimatedPrice} onChange={e => { const items = [...formItems]; items[i].estimatedPrice = e.target.value; setFormItems(items) }} className="w-20 px-2 py-1.5 border rounded text-right" />
                    <button onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} className="text-red-400">×</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setFormItems([...formItems, { name: '', specification: '', quantity: '', unit: '个', estimatedPrice: '', rawMaterialId: '' }])} className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 block">+ 添加物品</button>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm" disabled={!form.title}>提交申请</button>
              </div>
            </div>
          </div>
        )}

        {/* 确认弹窗 */}
        {confirmId && confirmAction && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setConfirmId(null); setConfirmAction(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-2">确认操作</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {confirmAction === 'APPROVED' ? '确认通过此采购申请？' :
                 confirmAction === 'REJECTED' ? '确认驳回此采购申请？' :
                 `确认将状态变更为「${statusLabel(confirmAction)}」？`}
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setConfirmId(null); setConfirmAction(null) }} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">取消</button>
                <button onClick={() => handleStatus(confirmId, confirmAction)} className={`px-4 py-2 text-sm rounded-lg text-white ${
                  confirmAction === 'REJECTED' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}>确认</button>
              </div>
            </div>
          </div>
        )}

        {/* 筛选栏 */}
        {apps.length > 0 && (
          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm bg-[var(--color-card)]"
            >
              <option value="">全部分类</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm bg-[var(--color-card)]"
            >
              <option value="">全部状态</option>
              <option value="PENDING">待审批</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已驳回</option>
              <option value="ORDERED">已采购</option>
              <option value="RECEIVED">已到货</option>
              <option value="REIMBURSED">已报销</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-[var(--color-card)] rounded-xl border p-4"><div className="flex gap-4"><div className="skeleton h-5 w-48" /><div className="skeleton h-5 w-20" /></div></div>)}</div>
        ) : (
          <div className="space-y-3">
            {apps
              .filter(a => !filterCategory || a.category === filterCategory)
              .filter(a => !filterStatus || a.status === filterStatus)
              .map(a => {
            const progress = getApprovalProgress(a)
            const canApprove = canCurrentUserApprove(a)
            const po = a.purchaseOrder
            return (
                <div key={a.id} className="bg-[var(--color-card)] rounded-xl border p-4 cursor-pointer" onClick={() => router.push(`/purchase/${a.id}`)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{a.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(a.status)}`}>{statusLabel(a.status)}</span>
                        {urgencyBadge(a.urgency)}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[a.category] || ''}`}>{CATEGORY_LABELS[a.category] || a.category}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {a.code} · {a.applicant.name} · ¥{Number(a.totalAmount).toFixed(2)} · {a.items.length} 项
                        {a.supplier && <span> · {a.supplier}</span>}
                      </div>

                      {/* 审批进度条 */}
                      {progress && (a.status === 'PENDING' || a.status === 'APPROVED') && (
                        <div className="mt-2 flex items-center gap-2">
                          {/* 进度点 */}
                          {Array.from({ length: progress.totalLevels }, (_, i) => {
                            const stage = approvalFlow?.stages?.filter(s =>
                              evaluateCondition(s.condition, Number(a.totalAmount))
                            ).sort((a, b) => a.level - b.level)[i]
                            const isApproved = i < progress.approvedLevels
                            const isCurrent = i === progress.approvedLevels
                            return (
                              <div key={i} className="flex items-center gap-1">
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                                  isApproved
                                    ? 'bg-green-100 text-green-700'
                                    : isCurrent
                                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                    : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    isApproved ? 'bg-green-500' : isCurrent ? 'bg-yellow-500' : 'bg-[var(--color-border)]'
                                  }`} />
                                  {stage?.label || `第${i + 1}级`}
                                </div>
                                {i < progress.totalLevels - 1 && (
                                  <span className="text-xs text-[var(--color-text-secondary)]">→</span>
                                )}
                              </div>
                            )
                          })}
                          {a.status === 'APPROVED' && (
                            <span className="text-xs text-green-600 font-medium ml-1">✓ 全部通过</span>
                          )}
                          {a.status === 'PENDING' && progress.isComplete && (
                            <span className="text-xs text-[var(--color-text-secondary)] ml-1">等待后续操作</span>
                          )}
                          {a.status === 'PENDING' && !progress.isComplete && progress.currentStage && (
                            <span className="text-xs text-[var(--color-text-secondary)] ml-1">
                              等待{ROLE_LABELS[progress.currentStage.role] || progress.currentStage.role}{progress.currentStage.condition ? '审批' : '审批'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0 ml-4" onClick={e => e.stopPropagation()}>
                      {/* 待审批状态 - 显示审批按钮 */}
                      {a.status === 'PENDING' && canApprove && (
                        <>
                          <button onClick={() => showConfirm(a.id, 'APPROVED')} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">通过</button>
                          <button onClick={() => showConfirm(a.id, 'REJECTED')} className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">驳回</button>
                        </>
                      )}
                      {a.status === 'PENDING' && !canApprove && (
                        <span className="px-3 py-1 text-xs text-[var(--color-text-secondary)] italic">等待审批</span>
                      )}
                      {a.status === 'APPROVED' && po && (
                        <button
                          onClick={() => router.push(`/purchase/orders/${po.id}`)}
                          className="px-3 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200"
                        >
                          查看PO ({po.poNo})
                        </button>
                      )}
                      {a.status === 'APPROVED' && !po && (
                        <button
                          onClick={() => handleGeneratePO(a.id)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          生成PO
                        </button>
                      )}
                      {a.status === 'ORDERED' && a.purchaseOrder && (
                        <button
                          onClick={() => router.push(`/purchase/orders/${a.purchaseOrder!.id}`)}
                          className="px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                        >
                          到货登记
                        </button>
                      )}
                      {a.status === 'RECEIVED' && (
                        <button
                          onClick={() => router.push('/reimbursement')}
                          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        >
                          去报销
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 空状态：无数据或筛选无结果 */}
        {!loading && apps.length === 0 && (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125V9M17.25 6v6m2-3v6m-10.5 4.5h7.5" /></svg><div className="empty-state-title">还没有采购申请</div><div className="empty-state-desc">点击右上角"新建采购申请"开始</div></div>
        )}
        {!loading && apps.length > 0 && apps.filter(a => !filterCategory || a.category === filterCategory).filter(a => !filterStatus || a.status === filterStatus).length === 0 && (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg><div className="empty-state-title">筛选无结果</div><div className="empty-state-desc">尝试调整筛选条件</div></div>
        )}
      </main>
    </div>
  )
}
