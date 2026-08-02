'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import FileUploader from '@/components/FileUploader'
import ProcessTimeline from '@/components/ProcessTimeline'
import RegistrationDocuments from '@/components/RegistrationDocuments'
import {
  FileText, CheckCircle2, Clock, AlertCircle, Circle,
  ChevronRight, ArrowUpDown, Calendar, Building2, Hash, Tag, FileSignature
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  APPLYING: '首次申请',
  SUPPLEMENT: '补充资料',
  REGISTERED: '已备案',
  CHANGE: '变更中',
  CANCELLED: '注销',
}

const STATUS_COLORS: Record<string, string> = {
  APPLYING: 'bg-blue-100 text-blue-700',
  SUPPLEMENT: 'bg-yellow-100 text-yellow-700',
  REGISTERED: 'bg-green-100 text-green-700',
  CHANGE: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

// 合规备案全流程预设阶段 — 用于 ProcessTimeline 组件
const PRESET_STAGES = [
  { stage: 'INGREDIENT_CHECK', label: '原料合规筛查', sortOrder: 0 },
  { stage: 'TESTING', label: '送检检测', sortOrder: 1 },
  { stage: 'SAFETY_ASSESSMENT', label: '安全评估', sortOrder: 2 },
  { stage: 'DOCUMENT_PREP', label: '备案资料编制', sortOrder: 3 },
  { stage: 'SUBMITTED', label: '已提交备案', sortOrder: 4 },
  { stage: 'ACCEPTED', label: '已受理', sortOrder: 5 },
  { stage: 'PUBLICITY', label: '公示中', sortOrder: 6 },
  { stage: 'COMPLETED', label: '备案完成', sortOrder: 7 },
]

// 状态流转
const STATUS_TRANSITIONS: Record<string, string[]> = {
  APPLYING: ['SUPPLEMENT', 'REGISTERED', 'CANCELLED'],
  SUPPLEMENT: ['APPLYING', 'REGISTERED', 'CANCELLED'],
  REGISTERED: ['CHANGE', 'CANCELLED'],
  CHANGE: ['REGISTERED', 'CANCELLED'],
  CANCELLED: ['APPLYING'],
}

interface Registration {
  id: string
  registerNo: string | null
  registerType: string
  applyDate: string | null
  approveDate: string | null
  expiryDate: string | null
  status: string
  remark: string | null
  product: { id: string; name: string; brand: string | null; category: string | null; capacity: string | null; status: string } | null
  testEntrustments: any[]
  attachments: any[]
}

export default function RegistrationDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [data, setData] = useState<Registration | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/compliance/registrations/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setData(json.registration)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载备案详情失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const updateStatus = async (newStatus: string) => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch(`/api/compliance/registrations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '状态更新失败')
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败')
    } finally {
      setSaving(false)
    }
  }

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
          <div className="w-full mx-auto px-4 md:px-6 py-4">
            <div className="skeleton h-6 w-48" />
          </div>
        </header>
        <main className="w-full mx-auto px-4 md:px-6 py-6">
          <div className="space-y-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 w-full" />)}
          </div>
        </main>
      </div>
    )
  }

  // 错误
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">{error}</p>
          <button onClick={() => router.push('/compliance/registrations')} className="mt-4 text-blue-600 hover:underline text-sm">
            返回备案列表
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const nextStatuses = STATUS_TRANSITIONS[data.status] || []

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* 头部 */}
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-2">
            <button onClick={() => router.push('/compliance')} className="hover:text-blue-600">合规中心</button>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => router.push('/compliance/registrations')} className="hover:text-blue-600">备案管理</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[var(--color-text)]">{data.product?.name || '备案详情'}</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--color-text)]">
                {data.product?.name || '未命名产品'}
              </h1>
              <span className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[data.status] || ''}`}>
                {STATUS_LABELS[data.status] || data.status}
              </span>
            </div>
            <div className="flex gap-2">
              {/* 状态流转按钮 */}
              {nextStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={saving}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    s === 'REGISTERED' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    s === 'CANCELLED' ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                    s === 'SUPPLEMENT' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                    'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {saving ? '处理中...' : `推进到「${STATUS_LABELS[s] || s}」`}
                </button>
              ))}
              <button
                onClick={() => router.push(`/compliance/registrations?id=${data.id}`)}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-gray-200 font-medium"
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：基本信息 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 产品信息卡片 */}
            <div className="bg-[var(--color-card)] rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />
                产品信息
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">产品名称：</span>
                  <span className="font-medium text-[var(--color-text)]">{data.product?.name || '-'}</span>
                </div>
                {data.product?.brand && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    <span className="text-[var(--color-text-secondary)]">品牌：</span>
                    <span className="text-[var(--color-text)]">{data.product.brand}</span>
                  </div>
                )}
                {data.product?.category && (
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    <span className="text-[var(--color-text-secondary)]">品类：</span>
                    <span className="text-[var(--color-text)]">{data.product.category}</span>
                  </div>
                )}
                {data.product?.capacity && (
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    <span className="text-[var(--color-text-secondary)]">规格：</span>
                    <span className="text-[var(--color-text)]">{data.product.capacity}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FileSignature className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">产品状态：</span>
                  <span className="text-[var(--color-text)]">{data.product?.status || '-'}</span>
                </div>
              </div>
            </div>

            {/* 备案信息卡片 */}
            <div className="bg-[var(--color-card)] rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-[var(--color-text-secondary)]" />
                备案信息
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">备案编号：</span>
                  <span className="font-medium text-[var(--color-text)]">{data.registerNo || '待获取'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">备案类型：</span>
                  <span className="text-[var(--color-text)]">{data.registerType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">申请日期：</span>
                  <span className="text-[var(--color-text)]">
                    {data.applyDate ? new Date(data.applyDate).toLocaleDateString('zh-CN') : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">批准日期：</span>
                  <span className="text-[var(--color-text)]">
                    {data.approveDate ? new Date(data.approveDate).toLocaleDateString('zh-CN') : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  <span className="text-[var(--color-text-secondary)]">有效期至：</span>
                  <span className="text-[var(--color-text)]">
                    {data.expiryDate ? new Date(data.expiryDate).toLocaleDateString('zh-CN') : '-'}
                  </span>
                </div>
                {data.remark && (
                  <div className="pt-2 border-t">
                    <span className="text-[var(--color-text-secondary)]">备注：</span>
                    <p className="text-[var(--color-text)] mt-1">{data.remark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 检测概览 */}
            <div className="bg-[var(--color-card)] rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />
                关联检测（{data.testEntrustments?.length || 0}）
              </h2>
              {data.testEntrustments && data.testEntrustments.length > 0 ? (
                <div className="space-y-2">
                  {data.testEntrustments.slice(0, 5).map((ins: any) => (
                    <div key={ins.id} className="flex items-center justify-between p-2 bg-[var(--color-bg)] rounded-lg text-sm">
                      <div>
                        <div className="text-[var(--color-text)] text-xs">
                          {ins.type === 'MICROBIAL' ? '微生物检测' :
                           ins.type === 'PHYSICAL' ? '理化检测' :
                           ins.type === 'STABILITY' ? '稳定性试验' :
                           ins.type === 'SAFETY' ? '安全性检测' :
                           ins.type === 'EFFICACY' ? '功效测评' :
                           ins.type === 'CHALLENGE' ? '防腐挑战' :
                           ins.type === 'PACKAGING' ? '包材相容性' : ins.type}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-secondary)]">{ins.institution}</div>
                      </div>
                      <span className={`text-xs ${
                        ins.result === 'PASS' ? 'text-green-600' :
                        ins.result === 'FAIL' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {ins.result === 'PASS' ? '✅ 通过' : ins.result === 'FAIL' ? '❌ 不通过' : '⏳ 待出'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--color-text-secondary)] text-center py-4">暂无关联检测</div>
              )}
              <button
                onClick={() => router.push(`/compliance/test-entrustments`)}
                className="w-full mt-2 text-xs text-blue-600 hover:text-blue-700 text-center py-1"
              >
                去送检 →
              </button>
            </div>

            {/* 安全评估报告（CPSR） */}
            <AssessmentSection registrationId={data.id} />
          </div>

          {/* 右侧：进度时间线 + 文件上传 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 业务进度时间线 */}
            <ProcessTimeline
              entityType="Registration"
              entityId={data.id}
              presetStages={PRESET_STAGES}
            />

            {/* 材料清单 */}
            <RegistrationDocuments registrationId={data.id} />

            {/* 备案文件上传 */}
            <div className="bg-[var(--color-card)] rounded-xl border">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
                <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  备案文件
                </h3>
              </div>
              <div className="p-4">
                <FileUploader
                  entityType="Registration"
                  entityId={data.id}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── 安全评估报告（CPSR）组件 ────────────────

interface Assessment {
  id: string
  assessor: string
  assessDate: string | null
  reportNo: string | null
  conclusion: 'PASS' | 'CONDITIONAL' | 'FAIL'
  fileUrl: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

const CONCLUSION_LABELS: Record<string, string> = {
  PASS: '通过',
  CONDITIONAL: '有条件通过',
  FAIL: '不通过',
}

const CONCLUSION_COLORS: Record<string, string> = {
  PASS: 'text-green-600 bg-green-50',
  CONDITIONAL: 'text-yellow-600 bg-yellow-50',
  FAIL: 'text-red-600 bg-red-50',
}

function AssessmentSection({ registrationId }: { registrationId: string }) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    assessor: '',
    assessDate: '',
    reportNo: '',
    conclusion: 'PASS',
    fileUrl: '',
    remark: '',
  })

  const fetchAssessments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/compliance/registrations/${registrationId}/assessments`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setAssessments(json.assessments || [])
    } catch {
      setAssessments([])
    } finally {
      setLoading(false)
    }
  }, [registrationId])

  useEffect(() => { fetchAssessments() }, [fetchAssessments])

  const resetForm = () => {
    setFormData({ assessor: '', assessDate: '', reportNo: '', conclusion: 'PASS', fileUrl: '', remark: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const openEdit = (a: Assessment) => {
    setFormData({
      assessor: a.assessor,
      assessDate: a.assessDate ? new Date(a.assessDate).toISOString().slice(0, 10) : '',
      reportNo: a.reportNo || '',
      conclusion: a.conclusion,
      fileUrl: a.fileUrl || '',
      remark: a.remark || '',
    })
    setEditingId(a.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!formData.assessor.trim()) return
    setSaving(true)
    try {
      const url = editingId
        ? `/api/compliance/registrations/${registrationId}/assessments/${editingId}`
        : `/api/compliance/registrations/${registrationId}/assessments`
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '保存失败')
      }
      resetForm()
      await fetchAssessments()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (aid: string) => {
    if (!confirm('确定删除此安全评估报告？')) return
    try {
      const res = await fetch(`/api/compliance/registrations/${registrationId}/assessments/${aid}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('删除失败')
      await fetchAssessments()
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="bg-[var(--color-card)] rounded-xl border p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />
        安全评估报告（{assessments.length}）
      </h2>

      {/* 列表 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="skeleton h-16 w-full rounded-lg" />)}
        </div>
      ) : assessments.length > 0 ? (
        <div className="space-y-2 mb-3">
          {assessments.map(a => (
            <div key={a.id} className="p-3 bg-[var(--color-bg)] rounded-lg text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--color-text)] font-medium">{a.assessor}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONCLUSION_COLORS[a.conclusion]}`}>
                  {CONCLUSION_LABELS[a.conclusion]}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                {a.reportNo && <span>编号：{a.reportNo}</span>}
                {a.assessDate && <span>评估日期：{new Date(a.assessDate).toLocaleDateString('zh-CN')}</span>}
              </div>
              {a.remark && <div className="text-xs text-[var(--color-text-secondary)] mt-1">备注：{a.remark}</div>}
              {a.fileUrl && (
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-blue-600 hover:underline mt-1 inline-block">📎 查看报告文件</a>
              )}
              <div className="flex gap-2 mt-1">
                <button onClick={() => openEdit(a)}
                        className="text-xs text-blue-600 hover:underline">编辑</button>
                <button onClick={() => handleDelete(a.id)}
                        className="text-xs text-red-500 hover:underline">删除</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-[var(--color-text-secondary)] text-center py-4">暂无安全评估报告</div>
      )}

      {/* 新增/编辑表单 */}
      {showForm ? (
        <div className="space-y-3 border-t pt-3 mt-2">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">评估机构 *</label>
            <input type="text" value={formData.assessor} onChange={e => setFormData(p => ({ ...p, assessor: e.target.value }))}
                   className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">评估日期</label>
              <input type="date" value={formData.assessDate} onChange={e => setFormData(p => ({ ...p, assessDate: e.target.value }))}
                     className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">报告编号</label>
              <input type="text" value={formData.reportNo} onChange={e => setFormData(p => ({ ...p, reportNo: e.target.value }))}
                     className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">评估结论</label>
            <select value={formData.conclusion} onChange={e => setFormData(p => ({ ...p, conclusion: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="PASS">通过</option>
              <option value="CONDITIONAL">有条件通过</option>
              <option value="FAIL">不通过</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">报告文件URL</label>
            <input type="text" value={formData.fileUrl} onChange={e => setFormData(p => ({ ...p, fileUrl: e.target.value }))}
                   placeholder="上传后粘贴文件URL"
                   className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">备注</label>
            <textarea value={formData.remark} onChange={e => setFormData(p => ({ ...p, remark: e.target.value }))} rows={2} maxLength={500}
                      className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving || !formData.assessor.trim()}
                    className="flex-1 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : editingId ? '更新' : '添加'}
            </button>
            <button onClick={resetForm}
                    className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
              取消
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
                className="w-full mt-2 text-xs text-blue-600 hover:text-blue-700 text-center py-1">
          + 添加安全评估报告
        </button>
      )}
    </div>
  )
}
