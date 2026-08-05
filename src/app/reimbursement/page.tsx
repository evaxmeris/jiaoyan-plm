'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}

export default function ReimbursementPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [form, setForm] = useState({
    applicantId: '',
    amount: '',
    description: '',
    receipts: '',
    purchaseApplicationId: '',
  })
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [purchaseApps, setPurchaseApps] = useState<{ id: string; code: string; title: string; totalAmount: number }[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch('/api/reimbursement')
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '加载失败')
      setLoading(false)
      return
    }
    const data = await res.json()
    setItems(data.data?.reimbursements || data.reimbursements || [])
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    if (user) setCurrentUser(user as any)
    fetchData()
  }, [fetchData, user])

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/users')
      const data = await res.json()
      setUsers(data.data?.users || data.users || [])
    } catch {}
  }

  const loadPurchaseApps = async () => {
    try {
      const res = await apiFetch('/api/purchase/applications?status=RECEIVED')
      if (res.ok) {
        const data = await res.json()
        setPurchaseApps(data.data?.applications || data.applications || [])
      }
    } catch {}
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({
      applicantId: currentUser?.id || '',
      amount: '',
      description: '',
      receipts: '',
      purchaseApplicationId: '',
    })
    setShowForm(true)
    loadUsers()
    loadPurchaseApps()
  }

  const openEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      applicantId: item.applicantId || currentUser?.id || '',
      amount: item.amount?.toString() || '',
      description: item.description || '',
      receipts: item.receipts ? (Array.isArray(item.receipts) ? item.receipts.join('\n') : typeof item.receipts === 'string' ? item.receipts : '') : '',
      purchaseApplicationId: item.purchaseApplicationId || '',
    })
    setShowForm(true)
    loadUsers()
    loadPurchaseApps()
  }

  const handleSave = async () => {
    const receiptsArr = form.receipts
      ? form.receipts.split('\n').map(s => s.trim()).filter(Boolean)
      : []

    const url = editingId ? `/api/reimbursement/${editingId}` : '/api/reimbursement'
    const method = editingId ? 'PUT' : 'POST'

    const body: any = {
      amount: form.amount,
      description: form.description,
      receipts: receiptsArr,
    }
    if (form.applicantId) {
      body.applicantId = form.applicantId
    }
    if (form.purchaseApplicationId) {
      body.purchaseApplicationId = form.purchaseApplicationId
    }

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || (editingId ? '更新失败' : '创建失败'))
      return
    }
    setShowForm(false)
    setEditingId(null)
    showToast('success', editingId ? '报销已更新' : '报销已创建')
    fetchData()
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await apiFetch(`/api/reimbursement/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '操作失败')
    } else {
      showToast('success', '状态已更新')
    }
    fetchData()
  }

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await apiFetch(`/api/reimbursement/${confirmDeleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    } else {
      showToast('success', '报销已删除')
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  const canSubmitApproval = (status: string) => status === 'DRAFT'
  const canEdit = (status: string) => status === 'DRAFT' || status === 'REJECTED'
  const canDelete = (status: string) => status === 'DRAFT' || status === 'REJECTED'

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">报销管理</h1>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建报销</button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 新建/编辑表单弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null) }}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? '编辑报销' : '新建报销'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">申请人</label>
                  <select
                    value={form.applicantId}
                    onChange={e => setForm({...form, applicantId: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                    disabled={!!editingId}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">报销金额 (¥) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={e => setForm({...form, amount: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">报销说明 *</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                    rows={3}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">关联采购申请（可选）</label>
                  <select
                    value={form.purchaseApplicationId}
                    onChange={e => setForm({...form, purchaseApplicationId: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="">不关联采购申请</option>
                    {purchaseApps.map(pa => (
                      <option key={pa.id} value={pa.id}>
                        {pa.code} - {pa.title} (¥{Number(pa.totalAmount).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[var(--color-text-secondary)] mb-1">附件（每行一个URL/路径）</label>
                  <textarea
                    value={form.receipts}
                    onChange={e => setForm({...form, receipts: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                    rows={3}
                    placeholder="https://example.com/receipt1.pdf&#10;https://example.com/receipt2.jpg"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                  disabled={!form.amount || !form.description}
                >
                  {editingId ? '保存修改' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 查看详情弹窗 */}
        {viewing && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setViewing(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">报销详情</h2>
              <div className="space-y-3 text-sm mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[var(--color-text-secondary)]">编号</span>
                    <p className="font-medium">{viewing.code}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)]">状态</span>
                    <p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[viewing.status] || ''}`}>
                        {STATUS_LABELS[viewing.status] || viewing.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)]">申请人</span>
                    <p className="font-medium">{viewing.applicant?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)]">金额</span>
                    <p className="font-medium">¥{Number(viewing.amount).toFixed(2)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[var(--color-text-secondary)]">说明</span>
                    <p>{viewing.description}</p>
                  </div>
                  {viewing.purchaseApplication && (
                    <div className="sm:col-span-2">
                      <span className="text-[var(--color-text-secondary)]">关联采购</span>
                      <p className="font-medium">{viewing.purchaseApplication.code} - {viewing.purchaseApplication.title} (¥{Number(viewing.purchaseApplication.totalAmount).toFixed(2)})</p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-[var(--color-text-secondary)]">创建时间</span>
                    <p>{new Date(viewing.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>

                {/* 附件列表 */}
                {viewing.receipts && Array.isArray(viewing.receipts) && viewing.receipts.length > 0 && (
                  <div>
                    <span className="text-[var(--color-text-secondary)]">附件</span>
                    <ul className="mt-1 space-y-1">
                      {viewing.receipts.map((r: string, i: number) => (
                        <li key={i}>
                          <a href={r.startsWith('http') ? r : '#'} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">
                            {r}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setViewing(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">关闭</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="flex gap-4"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-20" /></div>)}</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125V9M17.25 6v6m2-3v6" />
            </svg>
            <div className="empty-state-title">暂无报销记录</div>
            <div className="empty-state-desc">点击右上角"新建报销"开始</div>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">编号</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">申请人</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">说明</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">金额</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">关联采购</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">状态</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">时间</th>
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium text-xs whitespace-nowrap">{item.code}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={item.applicant?.name || '-'}>{item.applicant?.name || '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[200px] truncate" title={item.description}>{item.description}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">¥{Number(item.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {item.purchaseApplication ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs" title={item.purchaseApplication.title}>
                          {item.purchaseApplication.code}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status] || ''}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button onClick={() => setViewing(item)} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">查看</button>
                        {canEdit(item.status) && <button onClick={() => openEdit(item)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">编辑</button>}
                        {canSubmitApproval(item.status) && (
                          <button onClick={() => handleStatusChange(item.id, 'PENDING_APPROVAL')} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">提交审批</button>
                        )}
                        {item.status === 'PENDING_APPROVAL' && currentUser?.role === 'CEO' && (
                          <>
                            <button onClick={() => handleStatusChange(item.id, 'APPROVED')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">通过</button>
                            <button onClick={() => handleStatusChange(item.id, 'REJECTED')} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">驳回</button>
                          </>
                        )}
                        {canDelete(item.status) && <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 删除确认 */}
      {confirmDeleteId && (
        <ConfirmDialog
          open={true}
          title="确认删除"
          message="确定要删除此报销记录吗？此操作不可撤销。"
          confirmLabel="删除"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
