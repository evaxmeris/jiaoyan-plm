'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings, Plus, Trash2, Save, ArrowUp, ArrowDown, Loader2, CheckCircle2, AlertCircle, List, RotateCcw, User } from 'lucide-react'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface Stage {
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
  module: string
  stages: Stage[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface UserItem {
  id: string
  name: string
  email: string
  role: string
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

const MODULE_OPTIONS = [
  { value: 'purchase', label: '采购申请 (PurchaseApplication)' },
  { value: 'service_contract', label: '服务合同 (ServiceContract)' },
  { value: 'user_registration', label: '用户注册 (UserRegistration)' },
]

const MODULE_LABELS: Record<string, string> = {
  purchase: '采购审批',
  service_contract: '服务合同审批',
  user_registration: '用户注册审批',
}

const CONDITION_OPTIONS = [
  { value: '', label: '无条件' },
  { value: 'amount<=5000', label: '金额 ≤ ¥5,000' },
  { value: 'amount>5000', label: '金额 > ¥5,000' },
  { value: 'amount<=10000', label: '金额 ≤ ¥10,000' },
  { value: 'amount>10000', label: '金额 > ¥10,000' },
  { value: 'amount<=50000', label: '金额 ≤ ¥50,000' },
  { value: 'amount>50000', label: '金额 > ¥50,000' },
]

export default function ApprovalFlowPage() {
  const [allFlows, setAllFlows] = useState<ApprovalFlow[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState('purchase')
  const [stages, setStages] = useState<Stage[]>([])
  const [flowName, setFlowName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const currentModuleFlows = allFlows.filter(f => f.module === selectedModule)
  const activeFlow = currentModuleFlows.find(f => f.isActive)
  const hasActiveFlow = !!activeFlow

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/settings/approval-flow')
      const json = await res.json()
      // 解包标准响应 {success, data:{flows, users}}，兼容旧格式顶层字段
      const data = json.data || json
      setAllFlows(data.flows || json.flows || [])
      setUsers(data.users || json.users || [])
    } catch (e) {
      setMessage({ type: 'error', text: '加载审批流程配置失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 当切换 module 时，加载该模块的流程
  useEffect(() => {
    const moduleFlows = allFlows.filter(f => f.module === selectedModule)
    const active = moduleFlows.find(f => f.isActive) || moduleFlows[0]
    if (active) {
      setStages(active.stages)
      setFlowName(active.name)
      setEditingFlowId(active.id)
    } else {
      setStages([{ level: 1, role: 'RND_MANAGER', label: '主管审批', condition: '' }])
      setFlowName(MODULE_LABELS[selectedModule] || '审批流程')
      setEditingFlowId(null)
    }
  }, [selectedModule, allFlows])

  const loadFlow = (flow: ApprovalFlow) => {
    setStages(flow.stages)
    setFlowName(flow.name)
    setEditingFlowId(flow.id)
  }

  const handleAddStage = () => {
    const newLevel = stages.length + 1
    setStages([...stages, { level: newLevel, role: 'RND_MANAGER', label: '', condition: '' }])
  }

  const handleRemoveStage = (index: number) => {
    const newStages = stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, level: i + 1 }))
    setStages(newStages)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newStages = [...stages]
    ;[newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]]
    setStages(newStages.map((s, i) => ({ ...s, level: i + 1 })))
  }

  const handleMoveDown = (index: number) => {
    if (index === stages.length - 1) return
    const newStages = [...stages]
    ;[newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]]
    setStages(newStages.map((s, i) => ({ ...s, level: i + 1 })))
  }

  const handleUpdateStage = (index: number, field: keyof Stage, value: string) => {
    const newStages = [...stages]
    ;(newStages[index] as any)[field] = value
    setStages(newStages)
  }

  // 选择具体审批人时，同时设置 approverId 和 approverName
  const handleSelectApprover = (index: number, userId: string) => {
    const user = users.find(u => u.id === userId)
    const newStages = [...stages]
    newStages[index] = {
      ...newStages[index],
      approverId: userId || undefined,
      approverName: user?.name || undefined,
    }
    setStages(newStages)
  }

  const handleClearApprover = (index: number) => {
    const newStages = [...stages]
    delete newStages[index].approverId
    delete newStages[index].approverName
    setStages(newStages)
  }

  // 当用户选择 role 时，同时清除 approverId（更合理的默认行为）
  const handleRoleChange = (index: number, role: string) => {
    const newStages = [...stages]
    newStages[index].role = role
    if (newStages[index].approverId) {
      // 当手动选择角色时，清除特定审批人（用户仍可重新选择）
    }
    setStages(newStages)
  }

  const handleSave = async () => {
    if (!flowName.trim()) {
      setMessage({ type: 'error', text: '请输入流程名称' })
      return
    }
    if (stages.length === 0) {
      setMessage({ type: 'error', text: '请至少添加一个审批阶段' })
      return
    }
    for (const stage of stages) {
      if (!stage.label.trim()) {
        setMessage({ type: 'error', text: '每个阶段必须填写名称' })
        return
      }
      if (!stage.role && !stage.approverId) {
        setMessage({ type: 'error', text: '每个阶段必须指定审批角色或具体审批人' })
        return
      }
    }

    setSaving(true)
    setMessage(null)
    try {
      const res = await apiFetch('/api/settings/approval-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flowName,
          module: selectedModule,
          stages: stages,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '保存失败')
      }
      const json = await res.json()
      setMessage({ type: 'success', text: '审批流程已保存' })
      fetchData() // 刷新列表
      setTimeout(() => setMessage(null), 3000)
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleActivateFlow = async (flow: ApprovalFlow) => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/settings/approval-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flow.name,
          module: flow.module,
          stages: flow.stages,
        }),
      })
      if (!res.ok) throw new Error('激活失败')
      setMessage({ type: 'success', text: '已切换审批流程' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '切换失败' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-500" />
            审批流程设置
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            配置各业务的审批流程，支持按角色或指定具体审批人，支持金额条件触发。
          </p>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：已有流程列表 */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <List className="w-4 h-4 text-emerald-500" />
                已配置流程
              </h2>
            </div>

            {/* 业务类型选择 */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">关联业务类型</label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 流程列表 */}
            <div className="divide-y divide-[var(--color-border)]">
              {currentModuleFlows.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--color-text-secondary)]">
                  暂无流程配置，请在右侧创建
                </div>
              ) : (
                currentModuleFlows.map((flow) => (
                  <div
                    key={flow.id}
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30 ${
                      flow.isActive ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''
                    }`}
                    onClick={() => loadFlow(flow)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {flow.name}
                          </span>
                          {flow.isActive && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full shrink-0">
                              当前
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          {flow.stages.length} 级 · {new Date(flow.updatedAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                      {!flow.isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleActivateFlow(flow) }}
                          className="ml-2 p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600"
                          title="切换为当前流程"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右侧：编辑区 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 流程名称 */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              流程名称 <span className="text-xs text-[var(--color-text-secondary)]">· {MODULE_LABELS[selectedModule] || selectedModule}</span>
            </label>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="审批流程名称"
            />
          </div>

          {/* 审批阶段列表 */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                审批阶段（{stages.length} 级）
              </h2>
              <button
                onClick={handleAddStage}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加阶段
              </button>
            </div>

            {stages.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                暂无审批阶段，点击上方按钮添加
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {stages.map((stage, index) => (
                  <div key={index} className="px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        {stage.level}
                      </span>
                      <input
                        type="text"
                        value={stage.label}
                        onChange={(e) => handleUpdateStage(index, 'label', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="阶段名称（如 主管审批）"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === stages.length - 1}
                          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleRemoveStage(index)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-10">
                      {/* 审批角色 */}
                      <div>
                        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">审批角色（兜底）</label>
                        <select
                          value={stage.role}
                          onChange={(e) => handleRoleChange(index, e.target.value)}
                          className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">请选择角色</option>
                          {Object.entries(ROLE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {/* 指定审批人 */}
                      <div>
                        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                          指定审批人 <span className="text-[10px] text-zinc-400">（可选，优先级高于角色）</span>
                        </label>
                        <div className="flex gap-1">
                          <select
                            value={stage.approverId || ''}
                            onChange={(e) => handleSelectApprover(index, e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">按角色审批</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({ROLE_LABELS[u.role] || u.role})
                              </option>
                            ))}
                          </select>
                          {stage.approverId && (
                            <button
                              onClick={() => handleClearApprover(index)}
                              className="px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                              title="清除指定审批人"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          )}
                        </div>
                        {stage.approverName && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <User className="w-3 h-3" />
                            {stage.approverName}
                          </div>
                        )}
                      </div>

                      {/* 触发条件 */}
                      <div>
                        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">触发条件</label>
                        <select
                          value={stage.condition}
                          onChange={(e) => handleUpdateStage(index, 'condition', e.target.value)}
                          className="w-full px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {CONDITION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                saving
                  ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>

          {/* 当前预览 */}
          {stages.length > 0 && (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">当前配置预览</h3>
              <div className="flex flex-wrap items-center gap-2">
                {stages.map((stage, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {stage.label || '未命名'}
                      </span>
                      <span className="text-[10px] text-emerald-500 ml-1">
                        {stage.approverName
                          ? `· ${stage.approverName}`
                          : stage.role
                            ? `· ${ROLE_LABELS[stage.role] || stage.role}`
                            : '· 未指定'}
                        {stage.condition && <span className="ml-1">({stage.condition})</span>}
                      </span>
                    </div>
                    {index < stages.length - 1 && (
                      <ArrowDown className="w-3.5 h-3.5 text-[var(--color-text-secondary)] shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
