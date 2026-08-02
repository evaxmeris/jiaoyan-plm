'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, Circle, Clock, AlertCircle, SkipForward,
  ChevronDown, ChevronUp, Upload, FileText
} from 'lucide-react'
import FileUploader from './FileUploader'

// ---- 类型定义 ----

interface MilestoneNode {
  id?: string
  stage: string
  label: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED'
  completedAt: string | null
  remark: string | null
  fileUrls: string[] | null
  sortOrder: number
}

interface PresetStage {
  stage: string
  label: string
  sortOrder: number
}

interface ProcessTimelineProps {
  entityType: string
  entityId: string
  /** 预设里程碑配置（定义每个阶段及其顺序） */
  presetStages: PresetStage[]
}

// ---- 辅助函数 ----

/** 获取状态对应的颜色类 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500'
    case 'IN_PROGRESS':
      return 'bg-blue-500'
    case 'FAILED':
      return 'bg-red-500'
    case 'SKIPPED':
      return 'bg-gray-300'
    default:
      return 'bg-gray-200'
  }
}

/** 获取状态对应的图标 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="w-5 h-5 text-green-600" />
    case 'IN_PROGRESS':
      return <Clock className="w-5 h-5 text-blue-600" />
    case 'FAILED':
      return <AlertCircle className="w-5 h-5 text-red-600" />
    case 'SKIPPED':
      return <SkipForward className="w-5 h-5 text-gray-400" />
    default:
      return <Circle className="w-5 h-5 text-gray-300" />
  }
}

/** 获取状态对应的中文标签 */
const STATUS_LABELS: Record<string, string> = {
  PENDING: '待办',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  SKIPPED: '已跳过',
  FAILED: '失败',
}

// ---- 组件 ----

export default function ProcessTimeline({
  entityType,
  entityId,
  presetStages,
}: ProcessTimelineProps) {
  const [milestones, setMilestones] = useState<MilestoneNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ---- 数据加载 ----

  const fetchMilestones = useCallback(async () => {
    if (!entityType || !entityId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entityType, entityId })
      const res = await fetch(`/api/milestones?${params}`)
      if (!res.ok) throw new Error('获取里程碑数据失败')
      const data = await res.json()
      const remote = (data.milestones || []) as MilestoneNode[]

      // 合并预设阶段与实际数据：以 presetStages 为基准，补充缺失的阶段
      const merged: MilestoneNode[] = presetStages.map((preset) => {
        const existing = remote.find((m) => m.stage === preset.stage)
        return existing || {
          stage: preset.stage,
          label: preset.label,
          status: 'PENDING' as const,
          completedAt: null,
          remark: null,
          fileUrls: null,
          sortOrder: preset.sortOrder,
        }
      })

      setMilestones(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取里程碑数据失败')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, presetStages])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  // ---- 操作 ----

  /** 更新单个里程碑状态 */
  const updateMilestone = async (
    stage: string,
    updates: Partial<MilestoneNode>
  ) => {
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          stage,
          ...updates,
        }),
      })
      if (!res.ok) throw new Error('更新里程碑失败')
      await fetchMilestones()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新里程碑失败')
    }
  }

  /** 标记完成 */
  const handleComplete = (stage: string) => {
    updateMilestone(stage, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    })
  }

  /** 标记跳过 */
  const handleSkip = (stage: string) => {
    updateMilestone(stage, { status: 'SKIPPED' })
  }

  /** 切换展开 */
  const toggleExpand = (stage: string) => {
    setExpandedId((prev) => (prev === stage ? null : stage))
  }

  // ---- 计算进度 ----

  const totalStages = presetStages.length
  const completedCount = milestones.filter(
    (m) => m.status === 'COMPLETED' || m.status === 'SKIPPED'
  ).length
  const progressPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0

  // ---- 渲染 ----

  // 空状态
  if (!entityType || !entityId) {
    return (
      <div className="text-sm text-gray-400 p-4 text-center">
        请先保存实体后再查看进度
      </div>
    )
  }

  // 加载中
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* 标题栏 + 进度百分比 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">业务进度</span>
          <span className="text-xs text-gray-400">
            ({completedCount}/{totalStages})
          </span>
        </div>
        <span className="text-sm font-semibold text-blue-600">
          {progressPercent}%
        </span>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 进度条 */}
      <div className="px-4 pt-4">
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 节点列表 */}
      <div className="px-4 py-4 space-y-2">
        {milestones.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">暂无里程碑节点</p>
        )}

        {milestones.map((milestone, index) => {
          const isExpanded = expandedId === milestone.stage
          const isLast = index === milestones.length - 1

          return (
            <div key={milestone.stage}>
              {/* 节点行 */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                  isExpanded ? 'bg-blue-50 border border-blue-100' : ''
                }`}
                onClick={() => toggleExpand(milestone.stage)}
              >
                {/* 状态图标 */}
                <div className="flex-shrink-0">
                  {getStatusIcon(milestone.status)}
                </div>

                {/* 节点信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {milestone.label}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded-full ${
                        milestone.status === 'COMPLETED'
                          ? 'bg-green-50 text-green-700'
                          : milestone.status === 'IN_PROGRESS'
                          ? 'bg-blue-50 text-blue-700'
                          : milestone.status === 'FAILED'
                          ? 'bg-red-50 text-red-700'
                          : milestone.status === 'SKIPPED'
                          ? 'bg-gray-50 text-gray-500'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {STATUS_LABELS[milestone.status] || milestone.status}
                    </span>
                  </div>
                  {milestone.completedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      完成时间：{new Date(milestone.completedAt).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* 展开/收起 */}
                <div className="flex-shrink-0 text-gray-400">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* 展开详情面板 */}
              {isExpanded && (
                <div className="ml-8 pl-3 border-l-2 border-blue-200 pb-2">
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {milestone.status !== 'COMPLETED' && milestone.status !== 'SKIPPED' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleComplete(milestone.stage)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          标记完成
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSkip(milestone.stage)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          跳过
                        </button>
                      </>
                    )}
                  </div>

                  {/* 备注 */}
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 font-medium">备注</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={2}
                      placeholder="添加备注..."
                      defaultValue={milestone.remark || ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (val !== (milestone.remark || '')) {
                          updateMilestone(milestone.stage, { remark: val || null })
                        }
                      }}
                    />
                  </div>

                  {/* 文件上传 — 使用已有的 FileUploader 组件 */}
                  <div className="mt-3">
                    <FileUploader
                      entityType={`Milestone-${milestone.stage}`}
                      entityId={entityId}
                    />
                  </div>
                </div>
              )}

              {/* 连接线（除最后一个节点） */}
              {!isLast && !isExpanded && (
                <div className="ml-[22px] w-0.5 h-2 bg-gray-200" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
