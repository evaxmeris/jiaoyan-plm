'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/components/Toast'

interface User {
  id: string
  email: string
  name: string
  role: string
  department: string | null
  isActive: boolean
  status: string
  approvedBy: string | null
  approvedAt: string | null
  rejectReason: string | null
  createdAt: string
}

interface PermItem {
  operation: string
  description: string
  override: { id: string; granted: boolean } | null
}

// 操作分组（与权限管理页面一致）
const MODULE_GROUPS: { key: string; label: string; operations: string[] }[] = [
  { key: 'formula', label: '研发 - 配方', operations: ['formula.view', 'formula.create', 'formula.update', 'formula.delete', 'formula.stabilize'] },
  { key: 'material', label: '研发 - 原料', operations: ['material.view', 'material.create', 'material.update', 'material.delete'] },
  { key: 'product', label: '研发 - 产品', operations: ['product.view', 'product.create', 'product.update', 'product.delete'] },
  { key: 'registration', label: '合规 - 备案', operations: ['registration.view', 'registration.create', 'registration.update', 'registration.delete'] },
  { key: 'test_entrustment', label: '合规 - 检测', operations: ['test_entrustment.view', 'test_entrustment.create', 'test_entrustment.update', 'test_entrustment.delete'] },
  { key: 'purchase', label: '采购审批', operations: ['purchase.view', 'purchase.create', 'purchase.update', 'purchase.delete', 'purchase.approve'] },
  { key: 'inventory', label: '库存管理', operations: ['inventory.view', 'inventory.create', 'inventory.update'] },
  { key: 'trademark', label: '资产 - 商标', operations: ['trademark.view', 'trademark.create', 'trademark.update'] },
  { key: 'patent', label: '资产 - 专利', operations: ['patent.view', 'patent.create', 'patent.update'] },
  { key: 'supplier', label: '供应链 - 供应商', operations: ['supplier.view', 'supplier.create', 'supplier.update', 'supplier.delete'] },
  { key: 'trade_secret', label: '技术秘密', operations: ['trade_secret.create', 'trade_secret.view', 'trade_secret.update', 'trade_secret.delete'] },
  { key: 'user', label: '系统 - 用户管理', operations: ['user.create', 'user.update'] },
  { key: 'audit', label: '系统 - 审计日志', operations: ['audit_log.view'] },
  { key: 'service_contract', label: '系统 - 服务合同', operations: ['service_contract.view', 'service_contract.create', 'service_contract.update', 'service_contract.approve', 'service_contract.delete'] },
  { key: 'sample', label: '研发 - 打样管理', operations: ['sample.view', 'sample.create', 'sample.update', 'sample.delete'] },
  { key: 'retained_sample', label: '研发 - 留样管理', operations: ['retained_sample.view', 'retained_sample.create', 'retained_sample.update', 'retained_sample.delete'] },
  { key: 'stability', label: '研发 - 稳定性跟踪', operations: ['stability.view', 'stability.create', 'stability.update', 'stability.delete'] },
  { key: 'shipping', label: '分销 - 物流发运', operations: ['shipping.view', 'shipping.create', 'shipping.update', 'shipping.delete', 'shipping.status'] },
  { key: 'logistics_provider', label: '分销 - 物流商管理', operations: ['logistics_provider.view', 'logistics_provider.create', 'logistics_provider.update', 'logistics_provider.delete'] },
]

const ROLE_LABELS: Record<string, string> = {
  CEO: '总经理',
  RND_MANAGER: '研发主管',
  DEVELOPER: '研发工程师',
  COMPLIANCE: '合规专员',
  PURCHASER: '采购专员',
  FINANCE: '财务/出纳',
  PRODUCTION: '生产专员',
  OBSERVER: '观察者',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: '待审批',
  ACTIVE: '已激活',
  DISABLED: '已禁用',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  DISABLED: 'bg-red-100 text-red-500',
}

const DEPARTMENTS = ['研发部', '合规部', '采购部', '财务部', '生产部', '总经办']

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({
    email: '', password: '', name: '', role: 'DEVELOPER', department: '',
  })
  const [userRole, setUserRole] = useState<string | null>(null)
  // 权限面板
  const [permTarget, setPermTarget] = useState<User | null>(null)
  const [permData, setPermData] = useState<PermItem[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState<string | null>(null)
  const permScrollRef = useRef<HTMLDivElement>(null)
  
  // 权限切换时保持滚动位置
  useEffect(() => {
    if (!permSaving && permScrollRef.current) {
      const saved = permScrollRef.current.dataset.scrollTop
      if (saved) {
        permScrollRef.current.scrollTop = parseInt(saved, 10)
        permScrollRef.current.dataset.scrollTop = ''
      }
    }
  }, [permSaving])

  // 审批弹窗
  const [approveTarget, setApproveTarget] = useState<User | null>(null)
  const [approveRole, setApproveRole] = useState('DEVELOPER')
  const [rejectTarget, setRejectTarget] = useState<User | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approving, setApproving] = useState(false)
  // 角色修改弹窗
  const [roleEditTarget, setRoleEditTarget] = useState<User | null>(null)
  const [roleEditValue, setRoleEditValue] = useState('')
  const [savingRole, setSavingRole] = useState(false)
  // 重置密码弹窗
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [resetPwd2, setResetPwd2] = useState('')
  const [resetting, setResetting] = useState(false)
  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  // 编辑基本信息弹窗
  const [editInfoTarget, setEditInfoTarget] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', department: '' })
  const [savingInfo, setSavingInfo] = useState(false)
  // 启用/禁用确认弹窗
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)
  const [toggling, setToggling] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/users')
    if (res.status === 403) {
      router.push('/')
      return
    }
    const data = await res.json()
    setUsers(data.data?.users || data.users || [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    // 检查当前用户角色
    if (user) setUserRole(user.role)
    fetchUsers()
  }, [fetchUsers, user])

  // 新建用户
  const handleCreate = async () => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ email: '', password: '', name: '', role: 'DEVELOPER', department: '' })
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '创建失败')
    }
  }

  // 打开角色修改弹窗
  const handleEdit = (user: User) => {
    setRoleEditTarget(user)
    setRoleEditValue(user.role)
  }

  const handleRoleSave = async () => {
    if (!roleEditTarget || !roleEditValue) return
    setSavingRole(true)
    const res = await fetch(`/api/users/${roleEditTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleEditValue }),
    })
    if (res.ok) {
      setRoleEditTarget(null)
      showToast('success', '角色修改成功')
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '更新失败')
    }
    setSavingRole(false)
  }

  // 启用/禁用（改为弹窗确认，不再用原生 confirm）
  const handleToggleActive = async () => {
    if (!toggleTarget) return
    setToggling(true)
    const action = toggleTarget.isActive ? '禁用' : '启用'
    const res = await fetch(`/api/users/${toggleTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !toggleTarget.isActive }),
    })
    if (res.ok) {
      setToggleTarget(null)
      showToast('success', `${action}成功`)
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '操作失败')
    }
    setToggling(false)
  }

  // 打开重置密码弹窗
  const handleOpenReset = (user: User) => {
    setResetTarget(user)
    setResetPwd('')
    setResetPwd2('')
  }

  // 提交重置密码
  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (!resetPwd || resetPwd.length < 6) {
      showToast('warning', '新密码长度不能少于6位')
      return
    }
    if (resetPwd !== resetPwd2) {
      showToast('warning', '两次输入的新密码不一致')
      return
    }
    setResetting(true)
    const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: resetPwd }),
    })
    if (res.ok) {
      setResetTarget(null)
      showToast('success', '密码重置成功')
    } else {
      const err = await res.json()
      showToast('error', err.error || '重置失败')
    }
    setResetting(false)
  }

  // 打开删除确认弹窗
  const handleOpenDelete = (user: User) => {
    setDeleteTarget(user)
  }

  // 提交删除（软删除）
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/users/${deleteTarget.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setDeleteTarget(null)
      showToast('success', '用户已删除')
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    }
    setDeleting(false)
  }

  // 打开编辑基本信息弹窗
  const handleOpenEditInfo = (user: User) => {
    setEditInfoTarget(user)
    setEditForm({ name: user.name || '', department: user.department || '' })
  }

  // 提交编辑基本信息
  const handleEditInfoSave = async () => {
    if (!editInfoTarget) return
    if (!editForm.name.trim()) {
      showToast('warning', '姓名不能为空')
      return
    }
    setSavingInfo(true)
    const res = await fetch(`/api/users/${editInfoTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name.trim(), department: editForm.department || null }),
    })
    if (res.ok) {
      setEditInfoTarget(null)
      showToast('success', '用户信息已更新')
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '更新失败')
    }
    setSavingInfo(false)
  }

  // 审批通过
  const handleApprove = async () => {
    if (!approveTarget) return
    setApproving(true)
    const res = await fetch(`/api/users/${approveTarget.id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: approveRole }),
    })
    if (res.ok) {
      setApproveTarget(null)
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '审批失败')
    }
    setApproving(false)
  }

  // 驳回
  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      showToast('warning', '请输入驳回原因')
      return
    }
    setApproving(true)
    const res = await fetch(`/api/users/${rejectTarget.id}/approve?action=reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason: rejectReason.trim() }),
    })
    if (res.ok) {
      setRejectTarget(null)
      setRejectReason('')
      fetchUsers()
    } else {
      const err = await res.json()
      showToast('error', err.error || '操作失败')
    }
    setApproving(false)
  }

  // 打开权限设置面板
  const handleOpenPerm = async (target: User) => {
    setPermTarget(target)
    setPermLoading(true)
    try {
      const res = await fetch(`/api/users/${target.id}/permissions`)
      if (!res.ok) { showToast('error', '加载权限信息失败'); return }
      const data = await res.json()
      // 兼容标准响应格式 { success, data: { permissions } } 与旧格式顶层 permissions
      setPermData(data.data?.permissions || data.permissions || [])
    } catch {
      showToast('error', '加载权限信息失败')
    } finally {
      setPermLoading(false)
    }
  }

  // 切换权限覆盖状态：null → true (允许) → false (拒绝) → null (未设置)
  const handlePermToggle = async (operation: string, currentOverride: { id: string; granted: boolean } | null) => {
    // 保存滚动位置，防止 state 更新后窗口跳回顶部
    if (permScrollRef.current) {
      permScrollRef.current.dataset.scrollTop = String(permScrollRef.current.scrollTop)
    }
    if (!permTarget) return

    let nextGranted: boolean | null
    if (currentOverride === null) {
      nextGranted = true  // 未设置 → 允许
    } else if (currentOverride.granted === true) {
      nextGranted = false // 允许 → 拒绝
    } else {
      nextGranted = null  // 拒绝 → 未设置
    }

    setPermSaving(operation)
    try {
      const res = await fetch(`/api/users/${permTarget.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, granted: nextGranted }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast('error', err.error || '保存失败')
        return
      }
      // 刷新权限列表
      await handleOpenPerm(permTarget)
    } catch {
      showToast('error', '保存失败')
    } finally {
      setPermSaving(null)
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      CEO: 'bg-purple-100 text-purple-700',
      RND_MANAGER: 'bg-blue-100 text-blue-700',
      DEVELOPER: 'bg-cyan-100 text-cyan-700',
      COMPLIANCE: 'bg-emerald-100 text-emerald-700',
      PURCHASER: 'bg-amber-100 text-amber-700',
      FINANCE: 'bg-rose-100 text-rose-700',
      PRODUCTION: 'bg-teal-100 text-teal-700',
      OBSERVER: 'bg-gray-100 text-gray-500',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[role] || 'bg-[var(--color-card)]'}`}>
        {ROLE_LABELS[role] || role}
      </span>
    )
  }

  const statusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {STATUS_LABELS[status] || status}
      </span>
    )
  }

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL')
  const activeUsers = users.filter(u => u.status !== 'PENDING_APPROVAL')

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">用户管理</h1>
          </div>
          {userRole === 'CEO' && (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建用户</button>
          )}
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6">
        {userRole !== 'CEO' && (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">权限不足，仅 CEO 可访问用户管理</div>
        )}

        {userRole === 'CEO' && (
          <>
            {/* 待审批用户 */}
            {pendingUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-amber-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  待审批用户（{pendingUsers.length}）
                </h2>
                <div className="bg-[var(--color-card)] rounded-xl border border-amber-200 overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-amber-50 border-b">
                        <th className="text-left px-4 py-3 text-amber-700 font-medium">姓名</th>
                        <th className="text-left px-4 py-3 text-amber-700 font-medium">邮箱</th>
                        <th className="text-left px-4 py-3 text-amber-700 font-medium">部门</th>
                        <th className="text-left px-4 py-3 text-amber-700 font-medium">注册时间</th>
                        <th className="text-right px-4 py-3 text-amber-700 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.map(u => (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-amber-50/50">
                          <td className="px-4 py-3 font-medium">{u.name}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.email}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.department || '-'}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setApproveTarget(u); setApproveRole('DEVELOPER') }}
                                className="px-3 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600"
                              >
                                通过
                              </button>
                              <button
                                onClick={() => { setRejectTarget(u); setRejectReason('') }}
                                className="px-3 py-1 text-xs bg-red-400 text-white rounded hover:bg-red-500"
                              >
                                驳回
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 已审批用户列表 */}
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">
                已审批用户（{activeUsers.length}）
              </h2>
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-[var(--color-bg)] border-b">
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">姓名</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">邮箱</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">角色</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">部门</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">状态</th>
                      <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">创建时间</th>
                      <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.email}</td>
                        <td className="px-4 py-3">{roleBadge(u.role)}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.department || '-'}</td>
                        <td className="px-4 py-3">{statusBadge(u.status)}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                        <td className="px-4 py-3 text-right">
                          {userRole === 'CEO' && (
                            <div className="flex gap-2 justify-end flex-wrap">
                              <button onClick={() => handleOpenPerm(u)} className="text-xs text-emerald-500 hover:text-emerald-700">权限</button>
                              <button onClick={() => handleEdit(u)} className="text-xs text-blue-500 hover:text-blue-700">角色</button>
                              <button onClick={() => handleOpenEditInfo(u)} className="text-xs text-cyan-500 hover:text-cyan-700">编辑</button>
                              <button onClick={() => handleOpenReset(u)} className="text-xs text-indigo-500 hover:text-indigo-700">重置密码</button>
                              <button onClick={() => setToggleTarget(u)} className={`text-xs ${u.isActive ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}>
                                {u.isActive ? '禁用' : '启用'}
                              </button>
                              <button onClick={() => handleOpenDelete(u)} className="text-xs text-red-500 hover:text-red-700">删除</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 新建用户弹窗 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">新建用户</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">邮箱 *</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" placeholder="user@example.com" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">密码 *</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" placeholder="初始密码" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">姓名 *</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm" placeholder="姓名" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">角色</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">部门</label>
                  <select value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    <option value="">无</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                  disabled={!form.email || !form.password || !form.name}>创建</button>
              </div>
            </div>
          </div>
        )}

        {/* 审批通过弹窗 */}
        {approveTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setApproveTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">审批通过</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                审批用户 <strong>{approveTarget.name}</strong>（{approveTarget.email}）
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">分配角色</label>
                  <select value={approveRole} onChange={e => setApproveRole(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm">
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setApproveTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleApprove} disabled={approving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50">
                  {approving ? '处理中...' : '确认通过'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 驳回弹窗 */}
        {rejectTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setRejectTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">驳回用户</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                驳回用户 <strong>{rejectTarget.name}</strong>（{rejectTarget.email}）
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1">驳回原因 *</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded text-sm" rows={3}
                    placeholder="请输入驳回原因" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setRejectTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleReject} disabled={approving || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm disabled:opacity-50">
                  {approving ? '处理中...' : '确认驳回'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 权限设置面板 */}
        {permTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setPermTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">权限设置</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {permTarget.name}（{permTarget.email}）— 角色：{ROLE_LABELS[permTarget.role] || permTarget.role}
                  </p>
                </div>
                <button onClick={() => setPermTarget(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] text-xl leading-none">&times;</button>
              </div>

              <div ref={permScrollRef} className="flex-1 overflow-y-auto p-4 [overflow-anchor:auto]">                 {permLoading ? (
                  <div className="text-center py-12 text-[var(--color-text-secondary)]">加载中...</div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      点击操作项的「未设置」循环切换：未设置 → 允许 → 拒绝 → 未设置。
                      「未设置」表示按角色权限判断。
                    </p>
                    {MODULE_GROUPS.map(group => {
                      const groupOps = permData.filter(p => group.operations.includes(p.operation))
                      if (groupOps.length === 0) return null
                      return (
                        <div key={group.key}>
                          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">{group.label}</h3>
                          <div className="grid gap-1.5">
                            {groupOps.map(item => {
                              const isSaving = permSaving === item.operation
                              let statusLabel: string
                              let statusColor: string
                              if (item.override === null) {
                                statusLabel = '未设置'
                                statusColor = 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                              } else if (item.override.granted) {
                                statusLabel = '允许'
                                statusColor = 'bg-emerald-100 text-emerald-700'
                              } else {
                                statusLabel = '拒绝'
                                statusColor = 'bg-red-100 text-red-700'
                              }
                              return (
                                <button
                                  key={item.operation}
                                  onClick={() => handlePermToggle(item.operation, item.override)}
                                  disabled={isSaving}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all hover:bg-[var(--color-bg)] ${
                                    isSaving ? 'opacity-50 cursor-wait' : ''
                                  }`}
                                >
                                  <div className="text-left">
                                    <div className="font-medium text-[var(--color-text)]">{item.description}</div>
                                    <div className="text-xs text-[var(--color-text-secondary)] font-mono">{item.operation}</div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                                    {isSaving ? '...' : statusLabel}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 角色修改弹窗 */}
        {roleEditTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setRoleEditTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">修改角色</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                用户：<strong>{roleEditTarget.name}</strong>（{roleEditTarget.email}）
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1.5">新角色</label>
                  <select value={roleEditValue} onChange={e => setRoleEditValue(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)]">
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}（{key}）</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setRoleEditTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleRoleSave} disabled={savingRole || !roleEditValue}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50">
                  {savingRole ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 重置密码弹窗 */}
        {resetTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setResetTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">重置密码</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                重置 <strong>{resetTarget.name}</strong>（{resetTarget.email}）的登录密码
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1.5">新密码 *</label>
                  <input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)]"
                    placeholder="至少6位" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1.5">确认新密码 *</label>
                  <input type="password" value={resetPwd2} onChange={e => setResetPwd2(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)]"
                    placeholder="再次输入新密码" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleResetPassword} disabled={resetting || !resetPwd || !resetPwd2}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50">
                  {resetting ? '重置中...' : '确认重置'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑基本信息弹窗 */}
        {editInfoTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditInfoTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">编辑用户信息</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                用户：<strong>{editInfoTarget.name}</strong>（{editInfoTarget.email}）
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1.5">姓名 *</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)]" />
                </div>
                <div>
                  <label className="block text-[var(--color-text-secondary)] mb-1.5">部门</label>
                  <select value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)]">
                    <option value="">无</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setEditInfoTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleEditInfoSave} disabled={savingInfo || !editForm.name.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50">
                  {savingInfo ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 启用/禁用确认弹窗 */}
        {toggleTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setToggleTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">{toggleTarget.isActive ? '禁用用户' : '启用用户'}</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                确定{toggleTarget.isActive ? '禁用' : '启用'}用户 <strong>{toggleTarget.name}</strong>（{toggleTarget.email}）？
                {toggleTarget.isActive && <span className="block mt-1 text-amber-600">禁用后该用户将无法登录。</span>}
              </p>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setToggleTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleToggleActive} disabled={toggling}
                  className={`px-4 py-2 text-white rounded-lg hover:opacity-90 text-sm disabled:opacity-50 ${toggleTarget.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {toggling ? '处理中...' : '确认'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
            <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1 text-red-600">删除用户</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                确定删除用户 <strong>{deleteTarget.name}</strong>（{deleteTarget.email}）？
              </p>
              <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 mb-4">
                删除后该用户将无法登录，且不可恢复。其历史业务数据（采购/报销/审批等）将保留。
              </div>
              <div className="flex gap-2 mt-2 justify-end">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm disabled:opacity-50">
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
