'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface DashboardData {
  fiscalYear: number
  totalBudget: number
  totalUsed: number
  totalRemaining: number
  overallRate: number
  departmentCount: number
  budgetOverview: Array<{
    id: string
    department: string
    totalAmount: number
    usedAmount: number
    remaining: number
    usageRate: number
    categories: Array<{
      id: string
      name: string
      allocatedAmount: number
      usedAmount: number
      remaining: number
      usageRate: number
    }>
  }>
  monthlyTrend: Array<{ month: number; total: number }>
  departmentRanking: Array<{
    department: string
    totalAmount: number
    usedAmount: number
    usageRate: number
  }>
  recentTransactions: Array<{
    id: string
    amount: number
    type: string
    description: string
    transactionDate: string
    budget: { department: string }
    category: { name: string } | null
  }>
}

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const TYPE_LABELS: Record<string, string> = { EXPENSE: '支出', REIMBURSEMENT: '报销', PAYMENT: '付款' }

function getColor(i: number): string {
  const colors = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
  return colors[i % colors.length]
}

function getUsageColor(rate: number): string {
  if (rate >= 90) return 'text-red-600'
  if (rate >= 70) return 'text-yellow-600'
  return 'text-emerald-600'
}

function getBarColor(rate: number): string {
  if (rate >= 90) return 'bg-red-500'
  if (rate >= 70) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

export default function BudgetDashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i - 1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/finance/dashboard?fiscalYear=${fiscalYear}`)
      const json = await res.json()
      if (res.ok) setData(json.data)
      else showToast('error', json.error || '加载失败')
    } catch {
      showToast('error', '加载仪表盘失败')
    }
    setLoading(false)
  }, [fiscalYear, showToast])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
          <div className="w-full mx-auto px-4 md:px-6 py-4"><h1 className="text-xl font-bold">预算仪表盘</h1></div>
        </header>
        <main className="w-full mx-auto px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="skeleton h-64 rounded-xl" />)}
          </div>
        </main>
      </div>
    )
  }

  if (!data) return null

  const maxMonthlyTotal = Math.max(...data.monthlyTrend.map(m => m.total), 1)
  const maxDeptUsed = Math.max(...data.departmentRanking.map(d => d.usedAmount), 1)

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/finance/budget')} className="text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">预算仪表盘</h1>
          </div>
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(parseInt(e.target.value))}
            className="px-3 py-1.5 border rounded-lg text-sm bg-[var(--color-card)]"
          >
            {years.map(y => <option key={y} value={y}>{y} 年度</option>)}
          </select>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in space-y-6">
        {/* KPI 卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--color-card)] rounded-xl border p-5">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">{fiscalYear} 年度预算总额</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">¥{data.totalBudget.toFixed(2)}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{data.departmentCount} 个部门</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-5">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">已使用</div>
            <div className="text-2xl font-bold text-rose-600">¥{data.totalUsed.toFixed(2)}</div>
            <div className={`text-xs mt-1 ${getUsageColor(data.overallRate)}`}>
              使用率 {data.overallRate}%
            </div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-5">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">剩余</div>
            <div className={`text-2xl font-bold ${data.totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ¥{data.totalRemaining.toFixed(2)}
            </div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-5">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">整体预算执行</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">{data.overallRate}%</div>
            <div className="w-full bg-[var(--color-border)] rounded-full h-2 mt-2">
              <div className={`h-2 rounded-full transition-all ${getBarColor(data.overallRate)}`} style={{ width: `${Math.min(100, data.overallRate)}%` }} />
            </div>
          </div>
        </div>

        {/* 部门预算总览 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-5">
          <h2 className="text-base font-semibold mb-4">部门预算总览</h2>
          <div className="space-y-4">
            {data.budgetOverview.map(dept => (
              <div key={dept.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{dept.department}</span>
                  <span className={`text-sm font-medium ${getUsageColor(dept.usageRate)}`}>
                    ¥{dept.usedAmount.toFixed(2)} / ¥{dept.totalAmount.toFixed(2)} ({dept.usageRate}%)
                  </span>
                </div>
                <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getBarColor(dept.usageRate)}`}
                    style={{ width: `${Math.min(100, dept.usageRate)}%` }}
                  />
                </div>
                {/* 科目明细 */}
                {dept.categories.length > 0 && (
                  <div className="mt-2 ml-2 space-y-1">
                    {dept.categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="text-[var(--color-text-secondary)] w-24 truncate">{cat.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 dark:bg-zinc-700">
                          <div
                            className={`h-1.5 rounded-full ${getBarColor(cat.usageRate)}`}
                            style={{ width: `${Math.min(100, cat.usageRate)}%` }}
                          />
                        </div>
                        <span className={`font-medium ${getUsageColor(cat.usageRate)}`}>
                          ¥{cat.usedAmount.toFixed(2)} ({cat.usageRate}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {data.budgetOverview.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">暂无预算数据</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 月度支出趋势 */}
          <div className="bg-[var(--color-card)] rounded-xl border p-5">
            <h2 className="text-base font-semibold mb-4">月度支出趋势</h2>
            <div className="h-48 flex items-end gap-2">
              {data.monthlyTrend.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative w-full flex justify-center">
                    {m.total > 0 && (
                      <span className="text-[10px] text-[var(--color-text-secondary)] absolute -top-4">
                        ¥{(m.total / 10000).toFixed(1)}万
                      </span>
                    )}
                  </div>
                  <div
                    className="w-full rounded-t bg-emerald-500 transition-all hover:bg-emerald-600"
                    style={{ height: `${(m.total / maxMonthlyTotal) * 100}%`, minHeight: m.total > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[10px] text-[var(--color-text-secondary)]">{MONTH_LABELS[m.month - 1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 部门支出排名 */}
          <div className="bg-[var(--color-card)] rounded-xl border p-5">
            <h2 className="text-base font-semibold mb-4">部门支出排名</h2>
            <div className="space-y-3">
              {data.departmentRanking.map((dept, i) => (
                <div key={dept.department}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${i < 3 ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm">{dept.department}</span>
                    </div>
                    <span className={`text-sm font-medium ${getUsageColor(dept.usageRate)}`}>
                      ¥{dept.usedAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-border)] rounded-full h-2 ml-7">
                    <div
                      className={`h-2 rounded-full transition-all ${getBarColor(dept.usageRate)}`}
                      style={{ width: `${(dept.usedAmount / maxDeptUsed) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {data.departmentRanking.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">暂无排名数据</p>
              )}
            </div>
          </div>
        </div>

        {/* 最近交易 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-5">
          <h2 className="text-base font-semibold mb-4">最近预算执行记录</h2>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">暂无执行记录</p>
          ) : (
            <div className="space-y-2">
              {data.recentTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.type === 'PAYMENT' ? 'bg-blue-100 text-blue-700' :
                      t.type === 'REIMBURSEMENT' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {TYPE_LABELS[t.type] || t.type}
                    </span>
                    <div>
                      <p className="font-medium text-[var(--color-text)]">{t.description}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {t.budget.department}
                        {t.category && ` · ${t.category.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium text-rose-600">¥{t.amount.toFixed(2)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(t.transactionDate).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
