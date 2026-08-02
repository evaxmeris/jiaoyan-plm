'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'

interface ApprovalItem {
  id: string
  level: number
  role: string | null
  approverId: string | null
  action: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED'
  comment: string | null
  createdAt: string
  approver: { id: string; name: string; email: string; role: string } | null
}

interface ApprovalRequest {
  id: string
  entityType: string
  entityId: string
  title: string
  amount: number | null
  requesterId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  createdAt: string
  requester: { id: string; name: string; email: string; role: string }
  approvals: ApprovalItem[]
}

type TabKey = 'pending' | 'processed' | 'initiated'

const TAB_LABELS: Record<TabKey, string> = {
  pending: '待我审批',
  processed: '我已审批',
  initiated: '我发起的',
}

// 实体类型图标映射
const ENTITY_ICONS: Record<string, string> = {
  PurchaseApplication: '💰',
  ServiceContract: '📋',
  Reimbursement: '🧾',
  Patent: '📜',
  Trademark: '🏷️',
  Payment: '💳',
  UserRegistration: '👤',
}

const ENTITY_LABELS: Record<string, string> = {
  PurchaseApplication: '采购申请',
  ServiceContract: '服务合同',
  Reimbursement: '报销申请',
  Patent: '专利',
  Trademark: '商标',
  Payment: '付款',
  UserRegistration: '用户注册',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '审批中',
  IN_PROGRESS: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

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

export default function ApprovalsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [userId, setUserId] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')
  const [confirmAction, setConfirmAction] = useState<{ requestId: string; action: string; approvalItemId: string } | null>(null)
  const [acting, setActing] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const newRes = await fetch('/api/approval-requests?limit=100')

      const newJson = await newRes.json()

      if (!newRes.ok) throw new Error(newJson.error || '加载审批请求失败')

      setRequests(newJson.data || [])
    } catch (e: any) {
      setError(e.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      setUserId(user.id || '')
      setUserRole(user.role || '')
    }
    fetchData()
  }, [fetchData, user])

  // 判断当前用户是否应该审批某请求的当前节点
  const isPendingForMe = (req: ApprovalRequest): boolean => {
    if (req.status !== 'PENDING' && req.status !== 'IN_PROGRESS') return false
    const pendingItem = req.approvals.find(a => a.action === 'PENDING')
    if (!pendingItem) return false
    if (pendingItem.approverId && pendingItem.approverId !== userId) return false
    if (!pendingItem.approverId && pendingItem.role && pendingItem.role !== userRole) return false
    if (userRole === 'CEO') return true
    if (!pendingItem.approverId && !pendingItem.role) return false
    return true
  }

  // 判断当前用户是否在某请求的审批链中操作过
  const hasActedOn = (req: ApprovalRequest): boolean => {
    return req.approvals.some(
      a => a.approverId === userId && a.action !== 'PENDING'
    )
  }

  // 按 tab 过滤
  const filteredByTab = (tab: TabKey): ApprovalRequest[] => {
    switch (tab) {
      case 'pending':
        return requests.filter(isPendingForMe)
      case 'processed':
        return requests.filter(r => hasActedOn(r))
      case 'initiated':
        return requests.filter(r => r.requesterId === userId)
      default:
        return []
    }
  }

  // 执行审批操作
  const handleApprove = async () => {
    if (!confirmAction) return
    setActing(true)
    try {
      const res = await fetch(`/api/approval-requests/${confirmAction.requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmAction.action,
          approvalItemId: confirmAction.approvalItemId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '操作失败')

      setConfirmAction(null)
      fetchData()
    } catch (e: any) {
      showToast('error', e.message || '操作失败')
    } finally {
      setActing(false)
    }
  }

  // 获取当前待审批节点
  const getCurrentPendingItem = (req: ApprovalRequest) => {
    return req.approvals.find(a => a.action === 'PENDING')
  }

  // 审批进度
  const getProgress = (req: ApprovalRequest) => {
    const total = req.approvals.length
    const done = req.approvals.filter(a => a.action !== 'PENDING').length
    return { done, total }
  }

  // 格式化时间
  const fmtDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const currentItems = filteredByTab(activeTab)
  const tabCounts: Record<TabKey, number> = {
    pending: filteredByTab('pending').length,
    processed: filteredByTab('processed').length,
    initiated: filteredByTab('initiated').length,
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">
              &larr; 返回
            </button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">审批中心</h1>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6">
        {/* Tab 切换 */}
        <div className="flex gap-1 mb-6 bg-[var(--color-card)] rounded-xl border p-1">
          {(['pending', 'processed', 'initiated'] as TabKey[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'
              }`}
            >
              {TAB_LABELS[tab]}
              <span className={`ml-1.5 text-xs ${
                activeTab === tab ? 'text-emerald-200' : 'text-[var(--color-text-secondary)]'
              }`}>
                ({tabCounts[tab]})
              </span>
            </button>
          ))}
        </div>

        {/* 错误状态 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600">
            {error}
            <button onClick={fetchData} className="ml-3 underline">重试</button>
          </div>
        )}

        {/* 加载中 */}
        {loading ? (
          <div className="text-center py-16 text-[var(--color-text-secondary)]">加载中...</div>
        ) : currentItems.length === 0 ? (
          /* 空状态 */
          <div className="text-center py-16">
            <div className="text-4xl mb-3">
              {activeTab === 'pending' ? '✅' : activeTab === 'processed' ? '📋' : '📝'}
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm">
              {activeTab === 'pending' && '暂无待审批的请求'}
              {activeTab === 'processed' && '暂无已审批的请求'}
              {activeTab === 'initiated' && '暂无发起的审批请求'}
            </p>
          </div>
        ) : (
          /* 审批卡片列表 */
          <div className="space-y-3">
            {currentItems.map(req => {
              const pendingItem = getCurrentPendingItem(req)
              const progress = getProgress(req)
              const icon = ENTITY_ICONS[req.entityType] || '📄'
              const typeLabel = ENTITY_LABELS[req.entityType] || req.entityType
              const isPending = (req.status === 'PENDING' || req.status === 'IN_PROGRESS') && isPendingForMe(req)

              return (
                <div key={req.id} className="bg-[var(--color-card)] rounded-xl border p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* 标题行 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg flex-shrink-0">{icon}</span>
                        <h3 className="font-medium text-[var(--color-text)] truncate">{req.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[req.status] || ''}`}>
                          {STATUS_LABELS[req.status] || req.status}
                        </span>
                      </div>

                      {/* 元信息 */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)] ml-7">
                        <span>{typeLabel}</span>
                        {req.amount != null && (
                          <span>金额: ¥{Number(req.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                        )}
                        <span>申请人: {req.requester.name}</span>
                        <span>{fmtDate(req.createdAt)}</span>
                      </div>

                      {/* 审批进度 */}
                      {progress.total > 0 && (
                        <div className="flex items-center gap-2 mt-2 ml-7">
                          {req.approvals.map((item, idx) => {
                            const isDone = item.action === 'APPROVED'
                            const isRejected = item.action === 'REJECTED'
                            const isPendingAction = item.action === 'PENDING'
                            const name = item.approver?.name || ROLE_LABELS[item.role || ''] || item.role || `第${item.level}级`
                            return (
                              <div key={item.id} className="flex items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                                    isDone
                                      ? 'bg-green-100 text-green-700'
                                      : isRejected
                                      ? 'bg-red-100 text-red-600'
                                      : isPendingAction && isPendingForMe(req)
                                      ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                      : isPendingAction
                                      ? 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                                      : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    isDone ? 'bg-green-500' : isRejected ? 'bg-red-500' : 'bg-[var(--color-border)]'
                                  }`} />
                                  {name}
                                  {isDone && ' ✓'}
                                  {isRejected && ' ✗'}
                                </span>
                                {idx < req.approvals.length - 1 && (
                                  <span className="text-[var(--color-text-secondary)] text-xs">→</span>
                                )}
                              </div>
                            )
                          })}
                          <span className="text-[10px] text-[var(--color-text-secondary)] ml-1">
                            {progress.done}/{progress.total}
                          </span>
                        </div>
                      )}

                      {/* 当前审批节点提示 */}
                      {pendingItem && isPendingForMe(req) && (
                        <div className="text-xs text-amber-600 mt-1 ml-7">
                          待您审批
                          {pendingItem.level > 1 && `（第 ${pendingItem.level} 级）`}
                        </div>
                      )}
                      {pendingItem && req.status === 'IN_PROGRESS' && !isPendingForMe(req) && (
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1 ml-7">
                          等待
                          {pendingItem.approver?.name || ROLE_LABELS[pendingItem.role || ''] || '下一级'}
                          审批
                        </div>
                      )}
                    </div>

                    {/* 审批按钮 */}
                    {isPending && pendingItem && (
                      <div className="flex gap-2 flex-shrink-0 items-start pt-1">
                        <button
                          onClick={() => setConfirmAction({
                            requestId: req.id,
                            action: 'APPROVED',
                            approvalItemId: pendingItem.id,
                          })}
                          className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => setConfirmAction({
                            requestId: req.id,
                            action: 'REJECTED',
                            approvalItemId: pendingItem.id,
                          })}
                          className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          驳回
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* 确认弹窗 */}
      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setConfirmAction(null)}
        >
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">
              {confirmAction.action === 'APPROVED' ? '通过审批' : '驳回申请'}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {confirmAction.action === 'APPROVED'
                ? '确认通过此审批请求？通过后进入下一级审批或完成审批。'
                : '确认驳回此审批请求？驳回后申请将终止。'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                disabled={acting}
              >
                取消
              </button>
              <button
                onClick={handleApprove}
                disabled={acting}
                className={`px-4 py-2 text-sm rounded-lg text-white font-medium ${
                  confirmAction.action === 'REJECTED'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {acting ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
