'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'
import SupplierInput from '@/components/SupplierInput'

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
  applicant: { id: string; name: string }
  items: { id: string; name: string; quantity: number; unit: string }[]
  approvals: { id: string; action: string; level: number; applicant: { id: string; name: string } }[]
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
  const [form, setForm] = useState({ title: '', supplier: '', supplierId: null as string | null, purpose: '', urgency: 'NORMAL', category: 'RAW_MATERIAL' })
  const [formItems, setFormItems] = useState<{ name: string; specification: string; quantity: string; unit: string; estimatedPrice: string; rawMaterialId: string }[]>([])
  const [budget, setBudget] = useState<BudgetInfo | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [rawMaterials, setRawMaterials] = useState<{ id: string; nameCn: string; unit: string }[]>([])
  // 按采购分类加载的物品（包材/实验用品/设备等，来自物资管理）
  const [supplies, setSupplies] = useState<{ id: string; name: string; unit: string; category: string }[]>([])
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  // 当前激活的标签页：pending=待审批 / handled=我已审批 / created=我创建的
  const [activeTab, setActiveTab] = useState<'pending' | 'handled' | 'created'>('pending')
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
    // 解包标准响应 {success, data:{applications}}，兼容旧格式顶层字段
    const appPayload = appsData.data || appsData
    setApps(appPayload.applications || appsData.applications || [])
    setApprovalFlow(appPayload.approvalFlow || appsData.approvalFlow || null)
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

  // ===== 列表按当前用户视角分区 =====
  // 待审批：状态 PENDING 且（我创建的 或 审批流程当前到我）——未完成的都在这里
  const myPending = apps.filter(a =>
    a.status === 'PENDING' && (a.applicant?.id === userId || canCurrentUserApprove(a))
  )
  // 我已审批：我作为审批人处理过（通过/驳回）的申请
  const myHandled = apps.filter(a =>
    !myPending.includes(a) &&
    (a.approvals || []).some((ap: any) => ap.applicant?.id === userId && (ap.action === 'APPROVED' || ap.action === 'REJECTED'))
  )
  // 我创建的：我创建的申请（含已通过/已驳回/已采购等，跟踪状态用；与「我已审批」可重叠——同一申请可能既是我创建又是我审批）
  const myCreated = apps.filter(a => a.applicant?.id === userId)
  const applyFilters = (list: PurchaseApp[]) => list
    .filter(a => !filterCategory || a.category === filterCategory)
    .filter(a => !filterStatus || a.status === filterStatus)
  const tabs = [
    { key: 'pending' as const, title: '待审批', raw: myPending, count: myPending.length, items: applyFilters(myPending), empty: '暂无待审批的申请' },
    { key: 'handled' as const, title: '我已审批', raw: myHandled, count: myHandled.length, items: applyFilters(myHandled), empty: '暂无你审批过的申请' },
    { key: 'created' as const, title: '我创建的', raw: myCreated, count: myCreated.length, items: applyFilters(myCreated), empty: '暂无你创建的申请' },
  ]
  // 当前激活标签页的分区内容（徽章显示分区原始数量，列表显示筛选后数量）
  const activeSection = tabs.find(t => t.key === activeTab) || tabs[0]
  // 筛选选项按当前标签页的实际数据动态生成（分类/状态取本分区出现过的值）
  const categoryOptions = [...new Set(activeSection.raw.map(a => a.category))].filter(c => CATEGORY_LABELS[c])
  const statusOptions = [...new Set(activeSection.raw.map(a => a.status))]

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
    setForm({ title: '', supplier: '', supplierId: null, purpose: '', urgency: 'NORMAL', category: 'RAW_MATERIAL' })
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

  // 删除申请（创建者：仅未走流程或被驳回可删；CEO：任意）
  const [deleteTarget, setDeleteTarget] = useState<PurchaseApp | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canDeleteApp = (a: PurchaseApp): boolean => {
    if (user?.role === 'CEO') return true
    if (a.applicant?.id !== userId) return false
    const processed = (a.approvals || []).some((ap: any) => ap.action === 'APPROVED' || ap.action === 'REJECTED')
    return a.status === 'REJECTED' || (a.status === 'PENDING' && !processed)
  }
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/purchase/applications/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '删除失败')
      showToast('success', '申请已删除')
      setDeleteTarget(null)
      fetchData()
    } catch (e: any) {
      showToast('error', e.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 申请卡片（列表分区共用）
  const renderAppCard = (a: PurchaseApp) => {
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
                    等待{ROLE_LABELS[progress.currentStage.role] || progress.currentStage.role}审批
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0 ml-4" onClick={e => e.stopPropagation()}>
            {/* 待审批状态 - 显示审批按钮 */}
            {a.status === 'PENDING' && canApprove && (
              <button onClick={() => router.push(`/purchase/${a.id}`)} className="px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">审批</button>
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
            {canDeleteApp(a) && (
              <button
                onClick={() => setDeleteTarget(a)}
                className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                删除
              </button>
            )}
          </div>
        </div>
      </div>
    )
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
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">采购审批</h1>
          </div>
          <button onClick={async () => {
            setShowForm(true)
            setForm({ ...form, category: 'RAW_MATERIAL' })
            try {
              const res = await apiFetch('/api/rnd/materials')
              const json = await res.json()
              setRawMaterials(json.rawMaterials || json.materials || [])
              // 同时预加载包材物品（切换分类时即时可用）
              const supRes = await apiFetch('/api/supply/supplies?category=PACKAGING')
              const supJson = await supRes.json()
              const list = supJson.supplies || supJson.data?.supplies || supJson.data || []
              setSupplies(Array.isArray(list) ? list : [])
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                <div className="sm:col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">采购标题 *</label><input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">采购分类</label>
                  <select
                    value={form.category}
                    onChange={async e => {
                      const cat = e.target.value
                      setForm({ ...form, category: cat })
                      // 非原料分类：按分类加载物资物品（包材/实验用品/设备等）
                      if (cat !== 'RAW_MATERIAL') {
                        try {
                          const res = await apiFetch(`/api/supply/supplies?category=${cat}`)
                          const json = await res.json()
                          const list = json.supplies || json.data?.supplies || json.data || []
                          setSupplies(Array.isArray(list) ? list : [])
                        } catch { setSupplies([]) }
                      }
                    }}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">供应商</label><SupplierInput value={form.supplier} onChange={(name, id) => setForm({ ...form, supplier: name, supplierId: id })} placeholder="输入名称自动匹配档案" className="w-full px-3 py-1.5 border rounded text-sm" /></div>
                <div><label className="block text-[var(--color-text-secondary)] mb-1">紧急程度</label><select value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm"><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option><option value="URGENT">紧急</option></select></div>
                <div className="sm:col-span-2"><label className="block text-[var(--color-text-secondary)] mb-1">用途说明</label><textarea value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} /></div>
              </div>
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">采购物品</h3>
              <div className="space-y-2 mb-3">
                {formItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center text-xs">
                    <select value={item.rawMaterialId} onChange={e => {
                      const items = [...formItems]
                      const selId = e.target.value
                      const isRaw = form.category === 'RAW_MATERIAL'
                      // 仅原料分类关联原料；其他分类（包材/物资）选中物资只带名称单位，不写 rawMaterialId（否则物资 id 进原料外键报 P2003）
                      items[i].rawMaterialId = isRaw ? selId : ''
                      if (selId) {
                        // 原料分类 → 从原料列表取；其他分类 → 从物资列表取
                        const picked = isRaw
                          ? rawMaterials.find(m => m.id === selId)
                          : supplies.find(s => s.id === selId)
                        if (picked) {
                          items[i].name = isRaw ? (picked as any).nameCn : (picked as any).name
                          items[i].unit = (picked as any).unit || ''
                        }
                      }
                      setFormItems(items)
                    }} className="w-28 px-2 py-1.5 border rounded text-xs">
                      <option value="">{form.category === 'RAW_MATERIAL' ? '原料...' : '物品...'}</option>
                      {(form.category === 'RAW_MATERIAL' ? rawMaterials : supplies).map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {form.category === 'RAW_MATERIAL' ? (opt as any).nameCn : (opt as any).name}
                        </option>
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

        {/* 标签页切换 + 筛选同一行：左侧三Tab，右侧分类/状态筛选（选项按本标签页实际数据动态生成） */}
        {!loading && apps.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap border-b border-[var(--color-border)]">
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setFilterCategory(''); setFilterStatus('') }}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]'
                  }`}
                >
                  {tab.title}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            {activeSection.raw.length > 0 && (categoryOptions.length > 0 || statusOptions.length > 0) && (
              <div className="flex gap-3">
                {categoryOptions.length > 0 && (
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="px-3 py-1.5 border rounded text-sm bg-[var(--color-card)]"
                  >
                    <option value="">全部分类</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                )}
                {statusOptions.length > 0 && (
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 border rounded text-sm bg-[var(--color-card)]"
                  >
                    <option value="">全部状态</option>
                    {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-[var(--color-card)] rounded-xl border p-4"><div className="flex gap-4"><div className="skeleton h-5 w-48" /><div className="skeleton h-5 w-20" /></div></div>)}</div>
        ) : apps.length === 0 ? (
          <div className="empty-state"><svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125V9M17.25 6v6m2-3v6m-10.5 4.5h7.5" /></svg><div className="empty-state-title">还没有采购申请</div><div className="empty-state-desc">点击右上角"新建采购申请"开始</div></div>
        ) : (
          <div key={activeSection.key} className="fade-in">
            {activeSection.items.length > 0 ? (
              <div className="space-y-3">{activeSection.items.map(renderAppCard)}</div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border p-4 text-center text-sm text-[var(--color-text-secondary)]">{activeSection.empty}</div>
            )}
          </div>
        )}
      </main>

      {/* 删除申请确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除申请"
        message={deleteTarget ? `确定删除「${deleteTarget.title}」吗？此操作将软删除该申请，可恢复。` : ''}
        confirmLabel={deleting ? '删除中...' : '删除'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
