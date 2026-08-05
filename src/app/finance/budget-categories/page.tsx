'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface BudgetCategory {
  id: string
  budgetId: string
  name: string
  allocatedAmount: number
  usedAmount: number
  sortOrder: number
  remark: string | null
  _count: { transactions: number }
}

interface BudgetInfo {
  id: string
  department: string
  fiscalYear: number
  totalAmount: number
  usedAmount: number
}

const DEFAULT_CATEGORIES = [
  '原料采购', '包装材料', '检测费用', '办公费用', '设备购置',
  '差旅费用', '市场推广', '人力成本', '其他费用',
]

function BudgetCategoriesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const budgetId = searchParams.get('budgetId')

  const [budgets, setBudgets] = useState<BudgetInfo[]>([])
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(budgetId || '')
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCategory, setEditCategory] = useState<BudgetCategory | null>(null)
  const [form, setForm] = useState({ name: '', allocatedAmount: '', remark: '', sortOrder: 0 })

  const isAdmin = user?.role === 'CEO' || user?.role === 'FINANCE'

  // 加载预算列表
  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        const res = await apiFetch('/api/finance/budget?fiscalYear=' + new Date().getFullYear())
        const data = await res.json()
        if (res.ok) setBudgets(data.data?.budgets || data.budgets || [])
      } catch {}
    }
    fetchBudgets()
  }, [])

  // 加载科目列表
  const fetchCategories = useCallback(async () => {
    if (!selectedBudgetId) {
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch(`/api/finance/budget-categories?budgetId=${selectedBudgetId}`)
      const data = await res.json()
      if (res.ok) setCategories(data.data?.categories || data.categories || [])
    } catch {
      showToast('error', '加载科目失败')
    }
    setLoading(false)
  }, [selectedBudgetId, showToast])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // 创建/更新科目
  const handleSave = async () => {
    if (!form.name) { showToast('error', '请输入科目名称'); return }
    if (!form.allocatedAmount || parseFloat(form.allocatedAmount) < 0) {
      showToast('error', '请输入有效分配金额'); return
    }

    const url = editCategory
      ? `/api/finance/budget-categories/${editCategory.id}`
      : '/api/finance/budget-categories'
    const method = editCategory ? 'PUT' : 'POST'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        budgetId: selectedBudgetId,
        name: form.name,
        allocatedAmount: parseFloat(form.allocatedAmount),
        sortOrder: form.sortOrder,
        remark: form.remark || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || '操作失败')
      return
    }

    showToast('success', editCategory ? '科目已更新' : '科目已创建')
    setShowForm(false)
    setEditCategory(null)
    setForm({ name: '', allocatedAmount: '', remark: '', sortOrder: 0 })
    fetchCategories()
  }

  // 删除科目
  const handleDelete = async (category: BudgetCategory) => {
    if (category.usedAmount > 0) {
      showToast('error', '该科目已有使用记录，无法删除')
      return
    }
    const res = await apiFetch(`/api/finance/budget-categories/${category.id}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || '删除失败')
      return
    }
    showToast('success', '科目已删除')
    fetchCategories()
  }

  const openCreate = () => {
    setEditCategory(null)
    setForm({ name: '', allocatedAmount: '', remark: '', sortOrder: 0 })
    setShowForm(true)
  }

  const openEdit = (cat: BudgetCategory) => {
    setEditCategory(cat)
    setForm({
      name: cat.name,
      allocatedAmount: String(cat.allocatedAmount),
      remark: cat.remark || '',
      sortOrder: cat.sortOrder,
    })
    setShowForm(true)
  }

  const selectedBudget = budgets.find(b => b.id === selectedBudgetId)
  const totalAllocated = categories.reduce((s, c) => s + c.allocatedAmount, 0)
  const totalUsed = categories.reduce((s, c) => s + c.usedAmount, 0)

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/finance/budget')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">预算科目管理</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedBudgetId}
              onChange={e => setSelectedBudgetId(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-[var(--color-card)]"
            >
              <option value="">请选择预算</option>
              {budgets.map(b => (
                <option key={b.id} value={b.id}>
                  {b.department} - {b.fiscalYear}年度 (¥{b.totalAmount.toFixed(2)})
                </option>
              ))}
            </select>
            {isAdmin && selectedBudgetId && (
              <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                + 新建科目
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 汇总信息 */}
        {selectedBudget && categories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--color-card)] rounded-xl border p-4">
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">科目数</div>
              <div className="text-2xl font-bold text-[var(--color-text)]">{categories.length}</div>
            </div>
            <div className="bg-[var(--color-card)] rounded-xl border p-4">
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">已分配总额</div>
              <div className="text-2xl font-bold text-blue-600">¥{totalAllocated.toFixed(2)}</div>
              {totalAllocated > 0 && (
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                  预算总额的 {selectedBudget.totalAmount > 0 ? Math.round(totalAllocated / selectedBudget.totalAmount * 100) : 0}%
                </div>
              )}
            </div>
            <div className="bg-[var(--color-card)] rounded-xl border p-4">
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">已使用</div>
              <div className="text-2xl font-bold text-rose-600">¥{totalUsed.toFixed(2)}</div>
            </div>
            <div className="bg-[var(--color-card)] rounded-xl border p-4">
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">未分配金额</div>
              <div className="text-2xl font-bold text-emerald-600">
                ¥{(selectedBudget.totalAmount - totalAllocated).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {!selectedBudgetId ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="empty-state-title">请选择预算</div>
            <div className="empty-state-desc">在上方选择预算后，可管理其下的细分科目</div>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[var(--color-card)] rounded-xl border p-4">
                <div className="skeleton h-5 w-48 mb-3" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div className="empty-state-title">暂无预算科目</div>
            <div className="empty-state-desc">
              {isAdmin ? '点击"新建科目"为预算添加细分科目（如：原料采购、包装材料、检测费用等）' : '暂无科目配置'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map(cat => {
              const rate = cat.allocatedAmount > 0 ? Math.round((cat.usedAmount / cat.allocatedAmount) * 100) : 0
              const remaining = cat.allocatedAmount - cat.usedAmount
              const isOverrun = remaining < 0

              return (
                <div key={cat.id} className={`bg-[var(--color-card)] rounded-xl border p-4 transition-shadow hover:shadow-md ${
                  isOverrun ? 'border-red-300' : rate >= 90 ? 'border-red-200' : rate >= 70 ? 'border-yellow-200' : ''
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-[var(--color-text)]">{cat.name}</h3>
                      {isOverrun && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full font-medium">超支</span>
                      )}
                      {rate >= 90 && !isOverrun && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full font-medium">预警</span>
                      )}
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {cat._count.transactions} 笔记录
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(cat)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">编辑</button>
                        {cat.usedAmount === 0 && (
                          <button onClick={() => handleDelete(cat)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">删除</button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2 text-sm">
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)]">分配金额</div>
                      <div className="font-medium text-[var(--color-text)]">¥{cat.allocatedAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)]">已使用</div>
                      <div className="font-medium text-rose-600">¥{cat.usedAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)]">剩余</div>
                      <div className={`font-medium ${isOverrun ? 'text-red-600' : 'text-emerald-600'}`}>
                        ¥{Math.abs(remaining).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isOverrun ? 'bg-red-500' : rate >= 90 ? 'bg-red-500' : rate >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, rate)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs font-medium">{rate}%</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        ¥{cat.usedAmount.toFixed(2)} / ¥{cat.allocatedAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {cat.remark && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2">{cat.remark}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 新建/编辑弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditCategory(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editCategory ? '编辑预算科目' : '新建预算科目'}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">科目名称 *</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {DEFAULT_CATEGORIES.filter(n => !editCategory || n === form.name).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm({ ...form, name: n })}
                        className={`px-2 py-1 text-xs rounded border ${
                          form.name === n ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'hover:bg-zinc-50'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="或手动输入科目名称"
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">分配金额 (¥) *</label>
                  <input
                    type="number"
                    value={form.allocatedAmount}
                    onChange={e => setForm({ ...form, allocatedAmount: e.target.value })}
                    placeholder="请输入分配金额"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                  {selectedBudget && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      预算总额：¥{selectedBudget.totalAmount.toFixed(2)} | 已分配：¥{totalAllocated.toFixed(2)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">排序</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">备注</label>
                  <textarea
                    value={form.remark}
                    onChange={e => setForm({ ...form, remark: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button onClick={() => { setShowForm(false); setEditCategory(null) }} className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700" disabled={!form.name || !form.allocatedAmount}>
                  {editCategory ? '保存修改' : '创建科目'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)] p-8"><div className="skeleton h-8 w-48 mb-6" /><div className="skeleton h-64 rounded-xl" /></div>}>
    <BudgetCategoriesContent />
  </Suspense>
}
