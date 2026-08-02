'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Plus, Edit2, Trash2, CheckCircle, Clock, AlertTriangle, X, ArrowUpDown, Save } from 'lucide-react'

interface RegistrationDocument {
  id: string
  registrationId: string
  name: string
  required: boolean
  status: 'PENDING' | 'SUBMITTED' | 'RETURNED'
  submitDate: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待提交',
  SUBMITTED: '已提交',
  RETURNED: '已退回',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUBMITTED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-red-100 text-red-600',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="w-3.5 h-3.5" />,
  SUBMITTED: <CheckCircle className="w-3.5 h-3.5" />,
  RETURNED: <AlertTriangle className="w-3.5 h-3.5" />,
}

// 状态可流转映射
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['RETURNED'],
  RETURNED: ['SUBMITTED', 'PENDING'],
}

const TRANSITION_LABELS: Record<string, string> = {
  SUBMITTED: '提交',
  RETURNED: '退回',
  PENDING: '重新提交',
}

export default function RegistrationDocuments({ registrationId }: { registrationId: string }) {
  const [documents, setDocuments] = useState<RegistrationDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDoc, setEditingDoc] = useState<RegistrationDocument | null>(null)
  const [formName, setFormName] = useState('')
  const [formRequired, setFormRequired] = useState(true)
  const [formRemark, setFormRemark] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/compliance/registrations/${registrationId}/documents`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载材料清单失败')
      setDocuments(json.data?.documents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载材料清单失败')
    } finally {
      setLoading(false)
    }
  }, [registrationId])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const openCreate = () => {
    setEditingDoc(null)
    setFormName('')
    setFormRequired(true)
    setFormRemark('')
    setShowForm(true)
  }

  const openEdit = (doc: RegistrationDocument) => {
    setEditingDoc(doc)
    setFormName(doc.name)
    setFormRequired(doc.required)
    setFormRemark(doc.remark || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)
    try {
      const url = editingDoc
        ? `/api/compliance/registrations/${registrationId}/documents/${editingDoc.id}`
        : `/api/compliance/registrations/${registrationId}/documents`
      const method = editingDoc ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          required: formRequired,
          remark: formRemark || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '保存失败')
      }
      setShowForm(false)
      setEditingDoc(null)
      fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (doc: RegistrationDocument, newStatus: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/compliance/registrations/${registrationId}/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '状态变更失败')
      }
      fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态变更失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (doc: RegistrationDocument) => {
    if (!confirm(`确定要删除材料「${doc.name}」吗？`)) return
    try {
      const res = await fetch(`/api/compliance/registrations/${registrationId}/documents/${doc.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '删除失败')
      }
      fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="bg-[var(--color-card)] rounded-xl border">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
        <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          材料清单
          {!loading && (
            <span className="text-xs text-[var(--color-text-secondary)] font-normal">
              （{documents.length} 项）
            </span>
          )}
        </h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-3 h-3" />
          新增材料
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* 内容 */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-full" />)}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-[var(--color-text-secondary)]/30 mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">暂无备案材料</p>
            <p className="text-xs text-[var(--color-text-secondary)]/70 mt-1">点击右上角按钮添加备案所需材料</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[var(--color-text-secondary)] text-xs">
                  <th className="text-left px-2 py-2 font-medium">材料名称</th>
                  <th className="text-center px-2 py-2 font-medium">必需</th>
                  <th className="text-center px-2 py-2 font-medium">状态</th>
                  <th className="text-center px-2 py-2 font-medium">提交日期</th>
                  <th className="text-left px-2 py-2 font-medium">备注</th>
                  <th className="text-center px-2 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => {
                  const nextStatuses = STATUS_TRANSITIONS[doc.status] || []
                  return (
                    <tr key={doc.id} className="border-b last:border-0 hover:bg-gray-50/50">
                      <td className="px-2 py-3 font-medium text-[var(--color-text)]">
                        <span className="flex items-center gap-1">
                          {doc.name}
                          {doc.required && <span className="text-red-400 text-xs">*</span>}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-[var(--color-text-secondary)]">
                        {doc.required ? '是' : '否'}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[doc.status] || ''}`}>
                          {STATUS_ICONS[doc.status]}
                          {STATUS_LABELS[doc.status] || doc.status}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-[var(--color-text-secondary)]">
                        {doc.submitDate ? new Date(doc.submitDate).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="px-2 py-3 text-xs text-[var(--color-text-secondary)] max-w-[120px] truncate">
                        {doc.remark || '-'}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* 状态流转按钮 */}
                          {nextStatuses.map(s => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(doc, s)}
                              disabled={saving}
                              className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors ${
                                s === 'SUBMITTED' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                s === 'RETURNED' ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                                'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              }`}
                            >
                              {TRANSITION_LABELS[s] || s}
                            </button>
                          ))}
                          {/* 编辑 & 删除 */}
                          <button
                            onClick={() => openEdit(doc)}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-blue-600 rounded"
                            title="编辑"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-red-600 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => { setShowForm(false); setEditingDoc(null) }}
        >
          <div className="bg-[var(--color-card)] rounded-xl p-5 max-w-md w-full mx-4 shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold">{editingDoc ? '编辑材料' : '新增材料'}</h4>
              <button onClick={() => { setShowForm(false); setEditingDoc(null) }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">材料名称 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="如：配方表、工艺简述、标签样稿、检测报告"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequired}
                    onChange={e => setFormRequired(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-[var(--color-text-secondary)]">必需材料</span>
                </label>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                <textarea
                  value={formRemark}
                  onChange={e => setFormRemark(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm"
                  rows={2}
                  placeholder="可选备注信息"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setShowForm(false); setEditingDoc(null) }}
                className="px-4 py-1.5 text-[var(--color-text-secondary)] text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || saving}
                className="flex items-center gap-1 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
