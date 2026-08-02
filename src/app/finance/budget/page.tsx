'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'

interface BudgetItem {
  id: string
  department: string
  fiscalYear: number
  totalAmount: number
  usedAmount: number
  calculatedUsed: number
  remaining: number
  usageRate: number
  applications: {
    id: string
    code: string
    title: string
    totalAmount: number
    status: string
    createdAt: string
    applicant: { name: string }
  }[]
}

const DEPARTMENTS = ['研发部', '采购部', '市场部', '综合部']

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + i - 1)

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

function getUsageColor(rate: number): string {
  if (rate >= 90) return 'text-red-600'
  if (rate >= 70) return 'text-yellow-600'
  return 'text-emerald-600'
}

function getProgressColor(rate: number): string {
  if (rate >= 90) return 'bg-red-500'
  if (rate >= 70) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: '草稿',
    PENDING: '待审批',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    ORDERED: '已采购',
    RECEIVED: '已到货',
    REIMBURSED: '已报销',
  }
  return labels[status] || status
}

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_YEAR)
  const [showForm, setShowForm] = useState(false)
  const [editBudget, setEditBudget] = useState<BudgetItem | null>(null)
  const [form, setForm] = useState({ department: '', fiscalYear: CURRENT_YEAR, totalAmount: '' })
  const [detailBudget, setDetailBudget] = useState<BudgetItem | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  // 判断是否为管理员（可编辑/删除）
  const isAdmin = user?.role === 'CEO' || user?.role === 'FINANCE'

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/budget?fiscalYear=${fiscalYear}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setBudgets(data.data?.budgets || data.budgets || [])
    } catch (err: any) {
      showToast('error', err.message)
    }
    setLoading(false)
  }, [fiscalYear, showToast])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  // 新建预算
  const handleCreate = async () => {
    if (!form.department) {
      showToast('error', '请选择部门')
      return
    }
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      showToast('error', '请输入有效预算金额')
      return
    }

    const res = await fetch('/api/finance/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: form.department,
        fiscalYear: form.fiscalYear,
        totalAmount: parseFloat(form.totalAmount),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || '操作失败')
      return
    }

    showToast('success', editBudget ? '预算已更新' : '预算已创建')
    setShowForm(false)
    setEditBudget(null)
    setForm({ department: '', fiscalYear: CURRENT_YEAR, totalAmount: '' })
    fetchBudgets()
  }

  // 删除预算
  const handleDelete = async (budget: BudgetItem) => {
    if (budget.usedAmount > 0) {
      showToast('error', '该预算已有使用记录，无法删除')
      return
    }

    const res = await fetch(`/api/finance/budget/${budget.id}`, {
      method: 'DELETE',
    })

    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || '删除失败')
      return
    }

    showToast('success', '预算已删除')
    fetchBudgets()
  }

  // 打开编辑表单
  const openEdit = (budget: BudgetItem) => {
    setEditBudget(budget)
    setForm({
      department: budget.department,
      fiscalYear: budget.fiscalYear,
      totalAmount: String(budget.totalAmount),
    })
    setShowForm(true)
  }

  // 打开新建表单
  const openCreate = () => {
    setEditBudget(null)
    setForm({ department: '', fiscalYear: CURRENT_YEAR, totalAmount: '' })
    setShowForm(true)
  }

  // 按年度汇总统计数据
  const totalBudget = budgets.reduce((s, b) => s + b.totalAmount, 0)
  const totalUsed = budgets.reduce((s, b) => s + b.calculatedUsed, 0)
  const totalRemaining = budgets.reduce((s, b) => s + b.remaining, 0)
  const overallRate = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">预算管理</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* 导航链接 */}
            <button
              onClick={() => router.push('/finance/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              预算仪表盘
            </button>
            <button
              onClick={() => router.push('/finance/budget-categories')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              预算科目
            </button>
            {/* 年度筛选 */}
            <select
              value={fiscalYear}
              onChange={e => setFiscalYear(parseInt(e.target.value))}
              className="px-3 py-1.5 border rounded-lg text-sm bg-[var(--color-card)]"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y} 年度</option>
              ))}
            </select>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
              >
                + 新建预算
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 年度汇总统计 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">年度预算总额</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">¥{totalBudget.toFixed(2)}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">已使用</div>
            <div className="text-2xl font-bold text-rose-600">¥{totalUsed.toFixed(2)}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">剩余</div>
            <div className="text-2xl font-bold text-emerald-600">¥{totalRemaining.toFixed(2)}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">整体使用率</div>
            <div className={`text-2xl font-bold ${getUsageColor(overallRate)}`}>{overallRate}%</div>
            <div className="w-full bg-[var(--color-border)] rounded-full h-1.5 mt-2">
              <div
                className={`h-1.5 rounded-full transition-all ${getProgressColor(overallRate)}`}
                style={{ width: `${overallRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 预算概览卡片 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[var(--color-card)] rounded-xl border p-4">
                <div className="skeleton h-5 w-48 mb-3" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="empty-state-title">暂无预算数据</div>
            <div className="empty-state-desc">
              {isAdmin ? '点击"新建预算"为各部门设定年度预算' : '请联系财务或管理员设置预算'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map(b => {
              const rate = b.usageRate
              const remaining = b.remaining
              const isOverrun = remaining < 0
              const isWarning = rate >= 90
              const isCaution = rate >= 70 && rate < 90

              return (
                <div
                  key={b.id}
                  className={`bg-[var(--color-card)] rounded-xl border p-5 transition-shadow hover:shadow-md ${
                    isOverrun ? 'border-red-300' : isWarning ? 'border-red-200' : isCaution ? 'border-yellow-200' : ''
                  }`}
                >
                  {/* 卡片头部 */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[var(--color-text)]">{b.department}</h3>
                      <span className="text-xs text-[var(--color-text-secondary)]">{b.fiscalYear} 年度</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverrun && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full font-medium">超支</span>
                      )}
                      {isWarning && !isOverrun && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full font-medium">预警</span>
                      )}
                      {isCaution && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium">注意</span>
                      )}
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(b)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            编辑
                          </button>
                          {b.usedAmount === 0 && (
                            <button
                              onClick={() => handleDelete(b)}
                              className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 金额信息 */}
                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)]">预算总额</div>
                      <div className="font-medium text-[var(--color-text)]">¥{b.totalAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)]">已使用</div>
                      <div className="font-medium text-rose-600">¥{b.calculatedUsed.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)]">剩余</div>
                      <div className={`font-medium ${isOverrun ? 'text-red-600' : 'text-emerald-600'}`}>
                        ¥{remaining.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div className="mb-2">
                    <div className="w-full bg-[var(--color-border)] rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(rate)} ${
                          isOverrun ? 'bg-red-500' : ''
                        }`}
                        style={{ width: `${Math.min(100, rate)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className={`text-xs font-medium ${getUsageColor(rate)}`}>{rate}%</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        ¥{b.calculatedUsed.toFixed(2)} / ¥{b.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* 预警提示 */}
                  {isOverrun && (
                    <p className="text-xs text-red-500 mt-1">⚠ 预算已超支 ¥{Math.abs(remaining).toFixed(2)}</p>
                  )}
                  {isWarning && !isOverrun && (
                    <p className="text-xs text-red-500 mt-1">⚠ 预算即将用完（{rate}%）</p>
                  )}
                  {isCaution && (
                    <p className="text-xs text-yellow-600 mt-1">⚡ 预算使用率已达 {rate}%，请注意控制</p>
                  )}

                  {/* 展开执行明细按钮 */}
                  {b.applications && b.applications.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                      <button
                        onClick={() => setDetailBudget(detailBudget?.id === b.id ? null : b)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {detailBudget?.id === b.id ? '收起明细' : `查看执行明细（${b.applications.length} 条）`}
                      </button>

                      {/* 执行明细列表 */}
                      {detailBudget?.id === b.id && (
                        <div className="mt-2 space-y-1.5">
                          {b.applications.map(app => (
                            <div
                              key={app.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-[var(--color-bg)] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                              onClick={() => router.push(`/purchase/${app.id}`)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[var(--color-text)] truncate">{app.title}</div>
                                <div className="text-[var(--color-text-secondary)]">
                                  {app.code} · {app.applicant.name}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                  app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                  app.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {getStatusLabel(app.status)}
                                </span>
                                <span className="font-medium text-rose-600">¥{Number(app.totalAmount).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 新建/编辑弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditBudget(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editBudget ? '编辑预算' : '新建预算'}</h2>
              {editBudget && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700">
                  当前已使用：¥{editBudget.usedAmount.toFixed(2)}，修改总额不会影响已使用金额
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">部门 *</label>
                  <select
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    disabled={!!editBudget}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="">请选择部门</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">年度 *</label>
                  <select
                    value={form.fiscalYear}
                    onChange={e => setForm({ ...form, fiscalYear: parseInt(e.target.value) })}
                    disabled={!!editBudget}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y} 年</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">预算总额 *</label>
                  <input
                    type="number"
                    value={form.totalAmount}
                    onChange={e => setForm({ ...form, totalAmount: e.target.value })}
                    placeholder="请输入预算金额"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => { setShowForm(false); setEditBudget(null) }}
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)]"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                  disabled={!form.department || !form.totalAmount}
                >
                  {editBudget ? '保存修改' : '创建预算'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
