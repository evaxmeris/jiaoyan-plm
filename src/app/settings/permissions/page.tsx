'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, ShieldCheck, Lock, Save, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface PermissionInfo {
  allowedRoles: string[]
  description: string
}

interface PermissionData {
  permissions: Record<string, PermissionInfo>
  allRoles: string[]
  defaultPermissions: Record<string, string[]>
}

// 操作分组（用于 UI 分区）
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

// 角色中文名
const ROLE_LABELS: Record<string, string> = {
  CEO: 'CEO',
  RND_MANAGER: '研发主管',
  DEVELOPER: '研发人员',
  COMPLIANCE: '合规专员',
  PURCHASER: '采购专员',
  FINANCE: '财务',
  PRODUCTION: '生产',
  OBSERVER: '观察者',
}

// 角色颜色
const ROLE_COLORS: Record<string, string> = {
  CEO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  RND_MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DEVELOPER: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  COMPLIANCE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PURCHASER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  FINANCE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  PRODUCTION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  OBSERVER: 'bg-gray-100 text-[var(--color-text)] dark:bg-gray-800 dark:text-gray-300',
}

export default function PermissionsPage() {
  return (
    <ErrorBoundary>
      <PermissionsPageContent />
    </ErrorBoundary>
  )
}

function PermissionsPageContent() {
  const [data, setData] = useState<PermissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch('/api/settings/permissions', { credentials: 'include' })
      let json: any
      try {
        json = await res.json()
      } catch {
        throw new Error('API 返回格式异常，无法解析 JSON')
      }
      if (!res.ok) throw new Error(json?.error || '加载失败')
      // 解包标准响应格式
      const pd = json.data || json
      if (!pd.permissions || typeof pd.permissions !== 'object') {
        console.error('[Permissions] API 返回缺少 permissions 字段:', pd)
        throw new Error('权限数据格式异常')
      }
      if (!Array.isArray(pd.allRoles)) {
        console.error('[Permissions] API 返回缺少 allRoles:', pd)
        pd.allRoles = []
      }
      setData(pd as PermissionData)
    } catch (e: any) {
      console.error('[Permissions] 加载失败:', e)
      setMessage({ type: 'error', text: e?.message || '加载权限配置失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPermissions().catch(() => {}) }, [loadPermissions])

  const isEdited = (op: string) => {
    if (!data) return false
    const current = edits[op] ?? data.permissions[op]?.allowedRoles ?? []
    const original = data.defaultPermissions[op] ?? []
    return JSON.stringify([...current].sort()) !== JSON.stringify([...original].sort())
  }

  const handleToggle = (op: string, role: string) => {
    // CEO 始终拥有全部权限，不可取消
    if (role === 'CEO') return

    setEdits(prev => {
      const current = prev[op] ?? data?.permissions[op]?.allowedRoles ?? []
      const next = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role]
      return { ...prev, [op]: next }
    })
  }

  const handleSave = async (op: string) => {
    const allowedRoles = edits[op] ?? data?.permissions[op]?.allowedRoles ?? []
    // CEO 必须始终在列
    if (!allowedRoles.includes('CEO')) allowedRoles.push('CEO')

    setSaving(op)
    setMessage(null)
    try {
      const res = await apiFetch('/api/settings/permissions', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: op, allowedRoles }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '保存失败')
      }
      // 更新本地数据
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [op]: { ...prev.permissions[op], allowedRoles },
          },
        }
      })
      setEdits(prev => {
        const next = { ...prev }
        delete next[op]
        return next
      })
      setMessage({ type: 'success', text: `「${data?.permissions[op]?.description || op}」权限已更新` })
      setTimeout(() => setMessage(null), 3000)
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '保存失败' })
    } finally {
      setSaving(null)
    }
  }

  const handleResetAll = async () => {
    if (!data) return
    if (!confirm('确定重置所有权限为默认值？此操作不可撤销。')) return

    setMessage(null)
    // 逐条恢复默认
    for (const [op, defaultRoles] of Object.entries(data.defaultPermissions)) {
      try {
        const res = await apiFetch('/api/settings/permissions', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: op, allowedRoles: defaultRoles }),
        })
        if (!res.ok) throw new Error(`重置 ${op} 失败`)
      } catch (e) {
        setMessage({ type: 'error', text: `重置 ${op} 失败` })
        return
      }
    }
    setEdits({})
    await loadPermissions()
    setMessage({ type: 'success', text: '所有权限已重置为默认值' })
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-[var(--color-text-secondary)] mb-4">{message?.text || '加载失败，请刷新页面重试'}</p>
          <button
            onClick={loadPermissions}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            权限管理
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            按操作配置各角色的访问权限。CEO 角色始终拥有全部权限（锁定）。
          </p>
        </div>
        <button
          onClick={handleResetAll}
          className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          重置为默认
        </button>
      </div>

      {/* 提示消息 */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* 权限表格 */}
      {MODULE_GROUPS.map(group => {
        const groupOps = group.operations.filter(op => op in data.permissions)
        if (groupOps.length === 0) return null

        return (
          <div key={group.key} className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              {group.label}
            </h2>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-[200px_1fr_auto] gap-4 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)]">
                <div>操作</div>
                <div className="flex gap-1.5 flex-wrap">
                  {data.allRoles.map(role => (
                    <div key={role} className="w-[calc(12.5%-4px)] min-w-[70px] text-center">{ROLE_LABELS[role] || role}</div>
                  ))}
                </div>
                <div className="text-right">操作</div>
              </div>

              {/* 数据行 */}
              <div className="divide-y divide-[var(--color-border)]">
                {groupOps.map(op => {
                  const perm = data.permissions[op]
                  const currentRoles = edits[op] ?? perm.allowedRoles
                  const modified = isEdited(op)
                  const isSaving = saving === op

                  return (
                    <div key={op} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                      {/* 移动端：操作名行 */}
                      <div className="md:hidden mb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{perm.description}</span>
                          <span className="text-xs text-[var(--color-text-secondary)] font-mono">{op}</span>
                        </div>
                        {modified && (
                          <span className="text-xs text-amber-500 mt-1 inline-block">已修改</span>
                        )}
                      </div>

                      <div className="md:grid md:grid-cols-[200px_1fr_auto] md:gap-4 items-center">
                        {/* 操作名（桌面） */}
                        <div className="hidden md:block">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{perm.description}</div>
                          <div className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">{op}</div>
                          {modified && <span className="text-xs text-amber-500 mt-0.5 inline-block">已修改</span>}
                        </div>

                        {/* 角色勾选框 */}
                        <div className="flex flex-wrap gap-1.5">
                          {data.allRoles.map(role => {
                            const checked = currentRoles.includes(role)
                            const isCeo = role === 'CEO'
                            return (
                              <label
                                key={role}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                                  checked
                                    ? `${ROLE_COLORS[role]} ring-1 ring-inset ring-current`
                                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                } ${isCeo ? 'opacity-80' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isCeo}
                                  onChange={() => handleToggle(op, role)}
                                  className="sr-only"
                                />
                                <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                                  checked
                                    ? 'bg-current border-current'
                                    : 'border-zinc-300 dark:border-zinc-600'
                                }`}>
                                  {checked && (
                                    <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                                <span className="hidden sm:inline">{ROLE_LABELS[role] || role}</span>
                                {isCeo && <Lock className="w-2.5 h-2.5" />}
                              </label>
                            )
                          })}
                        </div>

                        {/* 保存按钮 */}
                        <div className="flex justify-end mt-2 md:mt-0">
                          <button
                            onClick={() => handleSave(op)}
                            disabled={!modified || isSaving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              modified && !isSaving
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            {isSaving ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
