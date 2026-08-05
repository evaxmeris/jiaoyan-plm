'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import FileUploader from '@/components/FileUploader'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const TYPES: Record<string, string> = { RAW_MATERIAL: '原料供应商', PACKAGING: '包材供应商', OEM: '代工厂', TESTING: '检测机构', CERTIFICATION_BODY: '认证机构', OTHER: '其他' }
const DOC_TYPES: Record<string, string> = {
  BUSINESS_LICENSE: '营业执照',
  PRODUCTION_LICENSE: '化妆品生产许可证',
  CERTIFICATION: '认证证书',
  NDA: '保密协议(NDA)',
  QUALITY_AGREEMENT: '质量协议',
  COA: '产品COA',
  MSDS: 'MSDS安全数据表',
  TDS: 'TDS技术数据表',
  GMP: 'GMP认证',
  ISO22716: 'ISO22716认证',
  CMA: 'CMA认证',
  CNAS: 'CNAS认证',
  CERT_SCOPE: '检测资质范围',
  AUTH_CERT: '认证资质证书',
  OTHER: '其他',
}
const DOC_STATUS: Record<string, string> = { VALID: '有效', EXPIRING: '即将到期', EXPIRED: '已过期' }
const AUDIT_RESULTS: Record<string, string> = { PASS: '通过', CONDITIONAL: '有条件通过', FAIL: '不通过' }

// 资质类型预置体系
const PRESET_QUALIFICATIONS: Record<string, string[]> = {
  OEM: ['PRODUCTION_LICENSE', 'BUSINESS_LICENSE', 'GMP', 'ISO22716', 'QUALITY_AGREEMENT', 'NDA'],
  RAW_MATERIAL: ['BUSINESS_LICENSE', 'PRODUCTION_LICENSE', 'COA', 'MSDS', 'TDS'],
  PACKAGING: ['BUSINESS_LICENSE', 'PRODUCTION_LICENSE', 'COA', 'MSDS', 'TDS'],
  TESTING: ['CMA', 'CNAS', 'CERT_SCOPE', 'BUSINESS_LICENSE'],
  CERTIFICATION_BODY: ['BUSINESS_LICENSE', 'CERTIFICATION', 'AUTH_CERT', 'QUALITY_AGREEMENT', 'NDA'],
  OTHER: ['AUTH_CERT', 'BUSINESS_LICENSE'],
}

type Tab = 'info' | 'documents' | 'audits' | 'evaluations'

export default function SupplierDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [supplier, setSupplier] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('info')

  // 表单状态
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ type: 'BUSINESS_LICENSE', name: '', fileUrl: '', issueDate: '', expireDate: '', notifyDays: '30', remark: '' })
  const [showAuditForm, setShowAuditForm] = useState(false)
  const [auditForm, setAuditForm] = useState({ auditDate: '', auditor: '', result: 'PASS', score: '', reportUrl: '', findings: '', remark: '' })
  const [showEvalForm, setShowEvalForm] = useState(false)
  const [evalForm, setEvalForm] = useState({ evalDate: '', scoreQuality: '', scoreDelivery: '', scoreService: '', evaluator: '', remark: '' })

  const fetchSupplier = useCallback(async () => {
    const res = await apiFetch(`/api/supply/suppliers`)
    const data = await res.json()
    const found = (data.suppliers || []).find((s: any) => s.id === id)
    setSupplier(found)
  }, [id])

  const fetchDocuments = useCallback(async () => {
    const res = await apiFetch(`/api/supply/suppliers/${id}/documents`)
    const data = await res.json()
    setDocuments(data.data || data.supplierDocuments || data.documents || [])
  }, [id])

  const fetchAudits = useCallback(async () => {
    const res = await apiFetch(`/api/supply/suppliers/${id}/audits`)
    const data = await res.json()
    setAudits(data.data || data.supplierAudits || data.audits || [])
  }, [id])

  const fetchEvaluations = useCallback(async () => {
    const res = await apiFetch(`/api/supply/suppliers/${id}/evaluations`)
    const data = await res.json()
    setEvaluations(data.data || data.supplierEvaluations || data.evaluations || [])
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchSupplier(), fetchDocuments(), fetchAudits(), fetchEvaluations()]).finally(() => setLoading(false))
  }, [fetchSupplier, fetchDocuments, fetchAudits, fetchEvaluations])

  const handleCreateDoc = async () => {
    await apiFetch(`/api/supply/suppliers/${id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docForm),
    })
    setShowDocForm(false)
    setDocForm({ type: 'BUSINESS_LICENSE', name: '', fileUrl: '', issueDate: '', expireDate: '', notifyDays: '30', remark: '' })
    fetchDocuments()
  }

  const handleCreateAudit = async () => {
    await apiFetch(`/api/supply/suppliers/${id}/audits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditForm),
    })
    setShowAuditForm(false)
    setAuditForm({ auditDate: '', auditor: '', result: 'PASS', score: '', reportUrl: '', findings: '', remark: '' })
    fetchAudits()
  }

  const handleCreateEval = async () => {
    await apiFetch(`/api/supply/suppliers/${id}/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evalForm),
    })
    setShowEvalForm(false)
    setEvalForm({ evalDate: '', scoreQuality: '', scoreDelivery: '', scoreService: '', evaluator: '', remark: '' })
    fetchEvaluations()
  }

  const expireWarning = (expireDate: string) => {
    if (!expireDate) return false
    const d = new Date(expireDate)
    const now = new Date()
    return d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">加载中...</div>
  if (!supplier) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">供应商不存在</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: '基本信息' },
    { key: 'documents', label: `资质文件 (${documents.length})` },
    { key: 'audits', label: `审计记录 (${audits.length})` },
    { key: 'evaluations', label: `评价记录 (${evaluations.length})` },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/supply/suppliers')} className="text-gray-400 hover:text-gray-600">&larr; 返回</button>
            <h1 className="text-xl font-bold text-gray-800">{supplier.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{TYPES[supplier.type] || supplier.type}</span>
          </div>
        </div>
        {/* 页签导航 */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* ===== 基本信息 ===== */}
        {tab === 'info' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">供应商名称</span><p className="font-medium">{supplier.name}</p></div>
              <div><span className="text-gray-400">类型</span><p className="font-medium">{TYPES[supplier.type] || supplier.type}</p></div>
              {supplier.contact && <div><span className="text-gray-400">联系人</span><p className="font-medium">{supplier.contact}</p></div>}
              {supplier.phone && <div><span className="text-gray-400">电话</span><p className="font-medium">{supplier.phone}</p></div>}
              {supplier.email && <div><span className="text-gray-400">邮箱</span><p className="font-medium">{supplier.email}</p></div>}
              {supplier.address && <div className="sm:col-span-2"><span className="text-gray-400">地址</span><p className="font-medium">{supplier.address}</p></div>}
              {supplier.license && <div><span className="text-gray-400">营业执照</span><p className="font-medium">{supplier.license}</p></div>}
              {supplier.rating != null && supplier.rating !== '' && (() => { const r = Math.min(5, Math.max(0, Math.round(Number(supplier.rating)) || 0)); return <div><span className="text-gray-400">评分</span><p className="font-medium text-amber-500">{r > 0 ? '★'.repeat(r) + '☆'.repeat(5 - r) : '未评分'} {supplier.rating}</p></div> })()}
              {supplier.remark && <div className="sm:col-span-2"><span className="text-gray-400">备注</span><p className="font-medium">{supplier.remark}</p></div>}
              <div><span className="text-gray-400">创建时间</span><p className="font-medium">{new Date(supplier.createdAt).toLocaleDateString('zh-CN')}</p></div>
              <div><span className="text-gray-400">状态</span><p className={`font-medium ${supplier.isActive ? 'text-green-600' : 'text-red-500'}`}>{supplier.isActive ? '启用' : '禁用'}</p></div>
            </div>
          </div>
        )}

        {/* ===== 资质文件 ===== */}
        {tab === 'documents' && (
          <div>
            {/* 预设资质 - 根据供应商类型展示必选资质清单 */}
            {supplier.type && PRESET_QUALIFICATIONS[supplier.type] && (
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-700 mb-3">
                  {TYPES[supplier.type] || supplier.type} - 必选资质清单
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_QUALIFICATIONS[supplier.type].map((qualType: string) => {
                    const hasDoc = documents.some(d => d.type === qualType)
                    return (
                      <div key={qualType} className={`bg-white rounded-xl border p-4 ${hasDoc ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${hasDoc ? 'bg-green-500' : 'bg-amber-400'}`} />
                            <span className="text-sm font-medium">{DOC_TYPES[qualType] || qualType}</span>
                          </div>
                          {hasDoc && <span className="text-xs text-green-600">✓ 已上传</span>}
                          {!hasDoc && <span className="text-xs text-amber-600">待上传</span>}
                        </div>
                        {!hasDoc && (
                          <div className="text-xs text-gray-400 mb-2">
                            请上传 {DOC_TYPES[qualType] || qualType} 文件
                          </div>
                        )}
                        <FileUploader
                          entityType="Supplier"
                          entityId={id}
                          fileTypeFilter={qualType}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-700">全部资质文件</h3>
              <button onClick={() => setShowDocForm(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">+ 新增资质文件</button>
            </div>
            {showDocForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDocForm(false)}>
                <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">新增资质文件</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><label className="block text-gray-500 mb-1">类型 *</label>
                      <select value={docForm.type} onChange={e => setDocForm({...docForm, type: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                        {/* 先显示预设资质类型（基于供应商类型） */}
                        {supplier.type && PRESET_QUALIFICATIONS[supplier.type] && PRESET_QUALIFICATIONS[supplier.type].map((k: string) =>
                          <option key={k} value={k}>{DOC_TYPES[k] || k}</option>
                        )}
                        {/* 分隔线效果 */}
                        {supplier.type && PRESET_QUALIFICATIONS[supplier.type] && <option disabled>────────</option>}
                        {/* 全部类型 */}
                        {Object.entries(DOC_TYPES).filter(([k]) =>
                          !supplier.type || !PRESET_QUALIFICATIONS[supplier.type] || !PRESET_QUALIFICATIONS[supplier.type].includes(k)
                        ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-gray-500 mb-1">文件名称 *</label>
                      <input type="text" value={docForm.name} onChange={e => setDocForm({...docForm, name: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="sm:col-span-2"><label className="block text-gray-500 mb-1">文件链接</label>
                      <input type="text" value={docForm.fileUrl} onChange={e => setDocForm({...docForm, fileUrl: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="文件 URL 或上传路径" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">签发日期</label>
                      <input type="date" value={docForm.issueDate} onChange={e => setDocForm({...docForm, issueDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">到期日期</label>
                      <input type="date" value={docForm.expireDate} onChange={e => setDocForm({...docForm, expireDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">提前提醒（天）</label>
                      <input type="number" value={docForm.notifyDays} onChange={e => setDocForm({...docForm, notifyDays: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="sm:col-span-2"><label className="block text-gray-500 mb-1">备注</label>
                      <textarea value={docForm.remark} onChange={e => setDocForm({...docForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowDocForm(false)} className="px-4 py-2 text-gray-500 text-sm">取消</button>
                    <button onClick={handleCreateDoc} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm" disabled={!docForm.name}>保存</button>
                  </div>
                </div>
              </div>
            )}
            {documents.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">暂无资质文件</div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{doc.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{DOC_TYPES[doc.type] || doc.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            doc.status === 'VALID' ? 'bg-green-100 text-green-700' :
                            doc.status === 'EXPIRING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-600'
                          }`}>{DOC_STATUS[doc.status] || doc.status}</span>
                          {expireWarning(doc.expireDate) && <span className="text-xs text-red-500">即将到期</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                      {doc.issueDate && <div>签发日期: {new Date(doc.issueDate).toLocaleDateString('zh-CN')}</div>}
                      {doc.expireDate && <div>到期日期: {new Date(doc.expireDate).toLocaleDateString('zh-CN')}</div>}
                      {doc.fileUrl && <div><a href={doc.fileUrl} target="_blank" className="text-blue-500 hover:underline">查看文件</a></div>}
                    </div>
                    {doc.remark && <div className="text-xs text-gray-400 mt-1">备注: {doc.remark}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 审计记录 ===== */}
        {tab === 'audits' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowAuditForm(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">+ 新增审计记录</button>
            </div>
            {showAuditForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAuditForm(false)}>
                <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">新增审计记录</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><label className="block text-gray-500 mb-1">审计日期 *</label>
                      <input type="date" value={auditForm.auditDate} onChange={e => setAuditForm({...auditForm, auditDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">审计人 *</label>
                      <input type="text" value={auditForm.auditor} onChange={e => setAuditForm({...auditForm, auditor: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">结果 *</label>
                      <select value={auditForm.result} onChange={e => setAuditForm({...auditForm, result: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm">
                        {Object.entries(AUDIT_RESULTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-gray-500 mb-1">评分</label>
                      <input type="number" step="0.1" min="0" max="100" value={auditForm.score} onChange={e => setAuditForm({...auditForm, score: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="sm:col-span-2"><label className="block text-gray-500 mb-1">报告链接</label>
                      <input type="text" value={auditForm.reportUrl} onChange={e => setAuditForm({...auditForm, reportUrl: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="sm:col-span-2"><label className="block text-gray-500 mb-1">审核发现 / 备注</label>
                      <textarea value={auditForm.remark} onChange={e => setAuditForm({...auditForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={3} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowAuditForm(false)} className="px-4 py-2 text-gray-500 text-sm">取消</button>
                    <button onClick={handleCreateAudit} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm" disabled={!auditForm.auditDate || !auditForm.auditor}>保存</button>
                  </div>
                </div>
              </div>
            )}
            {audits.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">暂无审计记录</div>
            ) : (
              <div className="space-y-3">
                {audits.map((a: any) => (
                  <div key={a.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{a.auditor} - {new Date(a.auditDate).toLocaleDateString('zh-CN')}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          a.result === 'PASS' ? 'bg-green-100 text-green-700' :
                          a.result === 'CONDITIONAL' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-600'
                        }`}>{AUDIT_RESULTS[a.result] || a.result}</span>
                        {a.score && <span className="text-xs text-gray-400 ml-2">得分: {a.score}</span>}
                      </div>
                    </div>
                    {a.reportUrl && <div className="text-xs mt-2"><a href={a.reportUrl} target="_blank" className="text-blue-500 hover:underline">查看报告</a></div>}
                    {a.remark && <div className="text-xs text-gray-400 mt-1">{a.remark}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 评价记录 ===== */}
        {tab === 'evaluations' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowEvalForm(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">+ 新增评价记录</button>
            </div>
            {showEvalForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowEvalForm(false)}>
                <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">新增评价记录</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><label className="block text-gray-500 mb-1">评价日期 *</label>
                      <input type="date" value={evalForm.evalDate} onChange={e => setEvalForm({...evalForm, evalDate: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">评价人 *</label>
                      <input type="text" value={evalForm.evaluator} onChange={e => setEvalForm({...evalForm, evaluator: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">质量评分 * (0-100)</label>
                      <input type="number" min="0" max="100" value={evalForm.scoreQuality} onChange={e => setEvalForm({...evalForm, scoreQuality: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">交期评分 * (0-100)</label>
                      <input type="number" min="0" max="100" value={evalForm.scoreDelivery} onChange={e => setEvalForm({...evalForm, scoreDelivery: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div><label className="block text-gray-500 mb-1">服务评分 * (0-100)</label>
                      <input type="number" min="0" max="100" value={evalForm.scoreService} onChange={e => setEvalForm({...evalForm, scoreService: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div></div>
                    <div className="sm:col-span-2"><label className="block text-gray-500 mb-1">备注</label>
                      <textarea value={evalForm.remark} onChange={e => setEvalForm({...evalForm, remark: e.target.value})} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowEvalForm(false)} className="px-4 py-2 text-gray-500 text-sm">取消</button>
                    <button onClick={handleCreateEval} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm" disabled={!evalForm.evalDate || !evalForm.evaluator}>保存</button>
                  </div>
                </div>
              </div>
            )}
            {evaluations.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">暂无评价记录</div>
            ) : (
              <div className="space-y-3">
                {evaluations.map((e: any) => (
                  <div key={e.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{e.evaluator} - {new Date(e.evalDate).toLocaleDateString('zh-CN')}</h3>
                        <div className="text-xs text-gray-400 mt-1">综合评分: <span className="font-semibold text-amber-600">{e.scoreTotal?.toFixed(1)}</span></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-xs">
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <div className="text-gray-400">质量</div>
                        <div className="font-medium">{e.scoreQuality}</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <div className="text-gray-400">交期</div>
                        <div className="font-medium">{e.scoreDelivery}</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <div className="text-gray-400">服务</div>
                        <div className="font-medium">{e.scoreService}</div>
                      </div>
                    </div>
                    {e.remark && <div className="text-xs text-gray-400 mt-2">备注: {e.remark}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
