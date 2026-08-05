'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface ProductDesign {
  id: string
  name: string
  brand: string | null
  category: string | null
  capacity: string | null
  status: string
  formulaId: string | null
  packagingBom: any | null
  designDoc: string | null
  launchDate: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
  formula: { id: string; name: string; code: string } | null
}

interface Certification {
  id: string
  productDesignId: string
  market: string
  certType: string
  certName: string
  certNo: string | null
  status: string
  applyDate: string | null
  approveDate: string | null
  expiryDate: string | null
  remark: string | null
}

interface MilestoneItem {
  id?: string
  stage: string
  label: string
  completed: boolean
  completedAt: string | null
  completedBy: string | null
  remark: string | null
}

interface FileItem {
  id: string
  name: string
  originalName: string
  url: string
  mimeType: string
  size: number
  fileType: string | null
  expireDate: string | null
  remark: string | null
  createdAt: string
}

interface PilotRun {
  id: string
  productDesignId: string
  batchNo: string
  scale: string
  producer: string
  plannedDate: string | null
  completedDate: string | null
  status: string
  result: string | null
  yield: number | null
  defects: any | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_LABELS: Record<string, string> = {
  CONCEPT: '概念', DESIGNING: '设计中', SAMPLING: '打样', TESTING: '检测中',
  REGISTERING: '备案中', READY: '可量产', LAUNCHED: '已上市', DISCONTINUED: '已停产',
}

const STATUS_COLORS: Record<string, string> = {
  CONCEPT: 'bg-gray-100 text-gray-600', DESIGNING: 'bg-blue-100 text-blue-700',
  SAMPLING: 'bg-yellow-100 text-yellow-700', TESTING: 'bg-orange-100 text-orange-700',
  REGISTERING: 'bg-purple-100 text-purple-700', READY: 'bg-green-100 text-green-700',
  LAUNCHED: 'bg-emerald-100 text-emerald-700', DISCONTINUED: 'bg-red-100 text-red-600',
}

const CERT_STATUS_LABELS: Record<string, string> = {
  PENDING: '待申请', IN_PROGRESS: '进行中', APPROVED: '已通过', REJECTED: '已拒绝', EXPIRED: '已过期',
}

const CERT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-red-100 text-red-600',
}

const MARKET_LABELS: Record<string, string> = {
  CN: '中国', US: '美国', EU: '欧盟', JP: '日本', OTHER: '其他',
}

const CERT_TYPE_LABELS: Record<string, string> = {
  REGISTRATION: '注册备案', CERTIFICATION: '认证', LABEL_CLAIM: '宣称备案',
}

const MILESTONE_STAGES = [
  'CONCEPT_REVIEW', 'FORMULA_FINALIZED', 'PACKAGING_CONFIRMED', 'SAMPLE_CONFIRMED',
  'EFFICACY_COMPLETED', 'REGISTRATION_COMPLETED', 'PILOT_COMPLETED', 'COMPLIANCE_READY', 'PRODUCTION_READY',
]

const PILOT_STATUS_LABELS: Record<string, string> = {
  PLANNED: '计划中', IN_PROGRESS: '进行中', COMPLETED: '已完成', CANCELLED: '已取消',
}

const PILOT_STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600',
}

const PILOT_RESULT_LABELS: Record<string, string> = {
  PASS: '通过', CONDITIONAL: '让步接收', FAIL: '不合格',
}

const PILOT_RESULT_COLORS: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700', CONDITIONAL: 'bg-yellow-100 text-yellow-700', FAIL: 'bg-red-100 text-red-600',
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN')
}

function isExpiringSoon(d: string | null): boolean {
  if (!d) return false
  const expiry = new Date(d)
  const warning = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  return expiry <= warning
}

function isExpired(d: string | null): boolean {
  if (!d) return false
  return new Date(d) < new Date()
}

export default function ProductDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [product, setProduct] = useState<ProductDesign | null>(null)
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [milestones, setMilestones] = useState<MilestoneItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [pilotRuns, setPilotRuns] = useState<PilotRun[]>([])
  const [costings, setCostings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'certs' | 'milestones' | 'files' | 'pilot-runs' | 'costings'>('info')

  // 认证表单
  const [showCertForm, setShowCertForm] = useState(false)
  const [certForm, setCertForm] = useState({
    market: 'CN', certType: 'REGISTRATION', certName: '', certNo: '',
    status: 'PENDING', applyDate: '', approveDate: '', expiryDate: '', remark: '',
  })
  const [editCertId, setEditCertId] = useState<string | null>(null)

  // 里程碑表单
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneStage, setMilestoneStage] = useState('')
  const [milestoneCompleted, setMilestoneCompleted] = useState(false)
  const [milestoneRemark, setMilestoneRemark] = useState('')

  // 试产表单
  const [showPilotRunForm, setShowPilotRunForm] = useState(false)
  const [editPilotRunId, setEditPilotRunId] = useState<string | null>(null)
  const [pilotRunForm, setPilotRunForm] = useState({
    scale: '', producer: '', plannedDate: '', completedDate: '',
    status: 'PLANNED', result: '', yield: '', remark: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [pRes, cRes, mRes, fRes, prRes, crRes] = await Promise.all([
      apiFetch(`/api/rnd/products/${id}`),
      apiFetch(`/api/rnd/products/${id}/certifications`),
      apiFetch(`/api/rnd/products/${id}/milestones`),
      apiFetch(`/api/files?entityType=ProductDesign&entityId=${id}`),
      apiFetch(`/api/rnd/products/${id}/pilot-runs`),
      apiFetch(`/api/rnd/costing?productId=${id}`),
    ])
    const p = await pRes.json()
    if (pRes.ok) setProduct(p.data || p.product)
    if (cRes.ok) {
      const c = await cRes.json()
      setCertifications(c.data?.certifications || c.certifications || [])
    }
    if (mRes.ok) {
      const m = await mRes.json()
      setMilestones(m.data?.milestones || m.milestones || [])
    }
    if (fRes.ok) {
      const f = await fRes.json()
      setFiles(f.data?.files || f.files || [])
    }
    if (prRes.ok) {
      const pr = await prRes.json()
      setPilotRuns(pr.data?.pilotRuns || pr.pilotRuns || [])
    }
    if (crRes.ok) {
      const cr = await crRes.json()
      setCostings(cr.data || cr.costings || [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 认证 CRUD
  const submitCertForm = async () => {
    const url = editCertId
      ? `/api/rnd/products/${id}/certifications?certId=${editCertId}`
      : `/api/rnd/products/${id}/certifications`
    const method = editCertId ? 'PUT' : 'POST'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(certForm),
    })
    if (res.ok) {
      setShowCertForm(false)
      setEditCertId(null)
      setCertForm({ market: 'CN', certType: 'REGISTRATION', certName: '', certNo: '', status: 'PENDING', applyDate: '', approveDate: '', expiryDate: '', remark: '' })
      fetchData()
    } else {
      const err = await res.json()
      alert(err.error || '保存失败')
    }
  }

  const openEditCert = (c: Certification) => {
    setEditCertId(c.id)
    setCertForm({
      market: c.market,
      certType: c.certType,
      certName: c.certName,
      certNo: c.certNo || '',
      status: c.status,
      applyDate: c.applyDate ? c.applyDate.slice(0, 10) : '',
      approveDate: c.approveDate ? c.approveDate.slice(0, 10) : '',
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
      remark: c.remark || '',
    })
    setShowCertForm(true)
  }

  const deleteCert = async (certId: string) => {
    if (!confirm('确定删除该认证记录？')) return
    const res = await apiFetch(`/api/rnd/products/${id}/certifications?certId=${certId}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  // 里程碑
  const submitMilestone = async () => {
    const m = milestones.find((m) => m.stage === milestoneStage)
    const res = await apiFetch(`/api/rnd/products/${id}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: milestoneStage,
        label: m?.label || milestoneStage,
        completed: milestoneCompleted,
        remark: milestoneRemark || null,
      }),
    })
    if (res.ok) {
      setShowMilestoneForm(false)
      setMilestoneStage('')
      setMilestoneCompleted(false)
      setMilestoneRemark('')
      fetchData()
    } else {
      const err = await res.json()
      alert(err.error || '保存失败')
    }
  }

  // 试产 CRUD
  const submitPilotRunForm = async () => {
    const url = editPilotRunId
      ? `/api/rnd/pilot-runs/${editPilotRunId}`
      : `/api/rnd/products/${id}/pilot-runs`
    const method = editPilotRunId ? 'PUT' : 'POST'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pilotRunForm),
    })
    if (res.ok) {
      setShowPilotRunForm(false)
      setEditPilotRunId(null)
      setPilotRunForm({ scale: '', producer: '', plannedDate: '', completedDate: '', status: 'PLANNED', result: '', yield: '', remark: '' })
      fetchData()
    } else {
      const err = await res.json()
      alert(err.error || '保存失败')
    }
  }

  const openEditPilotRun = (pr: PilotRun) => {
    setEditPilotRunId(pr.id)
    setPilotRunForm({
      scale: pr.scale,
      producer: pr.producer,
      plannedDate: pr.plannedDate ? pr.plannedDate.slice(0, 10) : '',
      completedDate: pr.completedDate ? pr.completedDate.slice(0, 10) : '',
      status: pr.status,
      result: pr.result || '',
      yield: pr.yield ? String(pr.yield) : '',
      remark: pr.remark || '',
    })
    setShowPilotRunForm(true)
  }

  const deletePilotRun = async (pilotRunId: string) => {
    if (!confirm('确定删除该试产记录？')) return
    const res = await apiFetch(`/api/rnd/pilot-runs/${pilotRunId}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>
  if (!product) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">产品不存在</div>

  const completedCount = milestones.filter((m) => m.completed).length
  const totalCount = MILESTONE_STAGES.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/rnd/products')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{product.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[product.status] || ''}`}>
              {STATUS_LABELS[product.status] || product.status}
            </span>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b">
          {[
            { key: 'info', label: '基本信息' },
            { key: 'certs', label: `认证 (${certifications.length})` },
            { key: 'milestones', label: `里程碑 (${completedCount}/${totalCount})` },
            { key: 'pilot-runs', label: `试产 (${pilotRuns.length})` },
            { key: 'costings', label: `成本核算 (${costings.length})` },
            { key: 'files', label: `附件 (${files.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: 基本信息 */}
        {activeTab === 'info' && (
          <div className="bg-[var(--color-card)] rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">基本信息</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-[var(--color-text-secondary)]">产品名称</span><p className="font-medium">{product.name}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">品牌</span><p className="font-medium">{product.brand || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">品类</span><p className="font-medium">{product.category || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">容量</span><p className="font-medium">{product.capacity || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">状态</span><p className="font-medium">{STATUS_LABELS[product.status] || product.status}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">关联配方</span><p className="font-medium">{product.formula ? `${product.formula.name} (${product.formula.code})` : '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">设计文档</span><p className="font-medium">{product.designDoc || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">上市日期</span><p className="font-medium">{formatDate(product.launchDate)}</p></div>
              <div className="col-span-2"><span className="text-[var(--color-text-secondary)]">备注</span><p className="font-medium whitespace-pre-wrap">{product.remark || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">创建时间</span><p className="font-medium">{formatDate(product.createdAt)}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">更新时间</span><p className="font-medium">{formatDate(product.updatedAt)}</p></div>
            </div>
          </div>
        )}

        {/* Tab: 认证信息 */}
        {activeTab === 'certs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">合规认证</h2>
              <button onClick={() => { setEditCertId(null); setCertForm({ market: 'CN', certType: 'REGISTRATION', certName: '', certNo: '', status: 'PENDING', applyDate: '', approveDate: '', expiryDate: '', remark: '' }); setShowCertForm(true) }}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 添加认证</button>
            </div>

            {certifications.length === 0 ? (
              <div className="bg-[var(--color-card)] rounded-xl border p-8 text-center text-[var(--color-text-secondary)] text-sm">暂无认证记录</div>
            ) : (
              <div className="space-y-3">
                {certifications.map((c) => {
                  const expiring = isExpiringSoon(c.expiryDate) && c.status === 'APPROVED'
                  const expired = isExpired(c.expiryDate)
                  return (
                    <div key={c.id} className="bg-[var(--color-card)] rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">{c.certName}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${CERT_STATUS_COLORS[c.status] || 'bg-[var(--color-card)]'}`}>
                            {CERT_STATUS_LABELS[c.status] || c.status}
                          </span>
                          {expired && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">已过期</span>}
                          {expiring && !expired && <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">即将到期</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditCert(c)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                          <button onClick={() => deleteCert(c.id)} className="px-2 py-1 text-xs border rounded text-red-400 hover:bg-red-50">删除</button>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-2 space-y-1">
                        <span className="mr-4">市场: {MARKET_LABELS[c.market] || c.market}</span>
                        <span className="mr-4">类型: {CERT_TYPE_LABELS[c.certType] || c.certType}</span>
                        {c.certNo && <span className="mr-4">编号: {c.certNo}</span>}
                        <span className="mr-4">申请日: {formatDate(c.applyDate)}</span>
                        <span className="mr-4">批准日: {formatDate(c.approveDate)}</span>
                        <span className={`mr-4 ${expiring ? 'text-yellow-600 font-medium' : ''}`}>到期日: {formatDate(c.expiryDate)}</span>
                      </div>
                      {c.remark && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{c.remark}</p>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 认证表单弹窗 */}
            {showCertForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCertForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">{editCertId ? '编辑认证' : '添加认证'}</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">市场 *</label>
                      <select value={certForm.market} onChange={(e) => setCertForm({ ...certForm, market: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                        {Object.entries(MARKET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">类型 *</label>
                      <select value={certForm.certType} onChange={(e) => setCertForm({ ...certForm, certType: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                        {Object.entries(CERT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">认证名称 *</label>
                      <input type="text" value={certForm.certName} onChange={(e) => setCertForm({ ...certForm, certName: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：药监局备案、FDA认证" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">认证编号</label>
                      <input type="text" value={certForm.certNo} onChange={(e) => setCertForm({ ...certForm, certNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">状态</label>
                      <select value={certForm.status} onChange={(e) => setCertForm({ ...certForm, status: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                        {Object.entries(CERT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">申请日期</label>
                      <input type="date" value={certForm.applyDate} onChange={(e) => setCertForm({ ...certForm, applyDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">批准日期</label>
                      <input type="date" value={certForm.approveDate} onChange={(e) => setCertForm({ ...certForm, approveDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">到期日期</label>
                      <input type="date" value={certForm.expiryDate} onChange={(e) => setCertForm({ ...certForm, expiryDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={certForm.remark} onChange={(e) => setCertForm({ ...certForm, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowCertForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={submitCertForm} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm" disabled={!certForm.certName}>
                      {editCertId ? '保存修改' : '保存'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: 里程碑 */}
        {activeTab === 'milestones' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">开发里程碑</h2>
            </div>

            {/* 进度条 */}
            <div className="bg-[var(--color-card)] rounded-xl border p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--color-text-secondary)]">开发进度</span>
                <span className="text-sm font-medium text-emerald-700">{completedCount}/{totalCount} ({progressPct}%)</span>
              </div>
              <div className="w-full bg-[var(--color-border)] rounded-full h-3">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* 里程碑列表 */}
            <div className="space-y-2">
              {milestones.map((m) => {
                const stageIdx = MILESTONE_STAGES.indexOf(m.stage)
                const completedSoFar = milestones.filter((mm) => MILESTONE_STAGES.indexOf(mm.stage) < stageIdx && mm.completed).length
                const isPrevCompleted = stageIdx === 0 || completedSoFar === stageIdx
                return (
                  <div key={m.stage} className={`bg-[var(--color-card)] rounded-xl border p-4 ${m.completed ? 'border-emerald-200' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          m.completed ? 'bg-emerald-500 text-white' : isPrevCompleted ? 'bg-[var(--color-border)] text-[var(--color-text-secondary)]' : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                        }`}>
                          {m.completed ? '✓' : stageIdx + 1}
                        </div>
                        <div>
                          <h3 className={`font-medium ${m.completed ? 'text-emerald-700' : 'text-[var(--color-text)]'}`}>{m.label}</h3>
                          {m.completed && m.completedAt && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              完成于 {formatDate(m.completedAt)}{m.completedBy ? ` · ${m.completedBy}` : ''}
                            </p>
                          )}
                          {m.remark && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{m.remark}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setMilestoneStage(m.stage)
                          setMilestoneCompleted(!m.completed)
                          setMilestoneRemark(m.remark || '')
                          setShowMilestoneForm(true)
                        }}
                        className={`px-3 py-1 text-xs rounded ${
                          m.completed ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {m.completed ? '取消完成' : '标记完成'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 里程碑表单弹窗 */}
            {showMilestoneForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowMilestoneForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">
                    {milestoneCompleted ? '标记完成' : '取消完成'}
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    {milestones.find((m) => m.stage === milestoneStage)?.label || milestoneStage}
                  </p>
                  <div className="text-sm mb-4">
                    <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                    <textarea value={milestoneRemark} onChange={(e) => setMilestoneRemark(e.target.value)} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} placeholder="可选备注" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowMilestoneForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={submitMilestone} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">确认</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: 试产记录 */}
        {activeTab === 'pilot-runs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">试产/中试记录</h2>
              <button onClick={() => { setEditPilotRunId(null); setPilotRunForm({ scale: '', producer: '', plannedDate: '', completedDate: '', status: 'PLANNED', result: '', yield: '', remark: '' }); setShowPilotRunForm(true) }}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ 新建试产</button>
            </div>

            {pilotRuns.length === 0 ? (
              <div className="bg-[var(--color-card)] rounded-xl border p-8 text-center text-[var(--color-text-secondary)] text-sm">
                暂无试产记录
                <p className="mt-2 text-xs">点击上方按钮新建试产批次，验证配方在放大生产中的稳定性</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pilotRuns.map((pr) => (
                  <div key={pr.id} className="bg-[var(--color-card)] rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{pr.batchNo}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PILOT_STATUS_COLORS[pr.status] || 'bg-[var(--color-card)]'}`}>
                          {PILOT_STATUS_LABELS[pr.status] || pr.status}
                        </span>
                        {pr.result && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${PILOT_RESULT_COLORS[pr.result] || 'bg-[var(--color-card)]'}`}>
                            {PILOT_RESULT_LABELS[pr.result] || pr.result}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditPilotRun(pr)} className="px-2 py-1 text-xs border rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-2 space-y-1">
                      <span className="mr-4">规模: {pr.scale}</span>
                      <span className="mr-4">生产方: {pr.producer}</span>
                      {pr.plannedDate && <span className="mr-4">计划日期: {formatDate(pr.plannedDate)}</span>}
                      {pr.completedDate && <span className="mr-4">完成日期: {formatDate(pr.completedDate)}</span>}
                      {pr.yield != null && <span className="mr-4">得率: {pr.yield}%</span>}
                    </div>
                    {pr.remark && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{pr.remark}</p>}
                    {pr.defects && Array.isArray(pr.defects) && pr.defects.length > 0 && (
                      <div className="mt-2 pt-2 border-t text-xs text-[var(--color-text-secondary)]">
                        <span className="font-medium text-[var(--color-text-secondary)]">缺陷记录: </span>
                        {pr.defects.map((d: any, i: number) => (
                          <span key={i} className="mr-3">{d.item} ({d.severity})</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 试产表单弹窗 */}
            {showPilotRunForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPilotRunForm(false)}>
                <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-lg font-semibold mb-4">{editPilotRunId ? '编辑试产记录' : '新建试产记录'}</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">试产规模 *</label>
                      <input type="text" value={pilotRunForm.scale} onChange={(e) => setPilotRunForm({ ...pilotRunForm, scale: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：5kg, 20kg, 100kg" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">生产方 *</label>
                      <input type="text" value={pilotRunForm.producer} onChange={(e) => setPilotRunForm({ ...pilotRunForm, producer: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" placeholder="代工厂名称或内部" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">状态</label>
                      <select value={pilotRunForm.status} onChange={(e) => setPilotRunForm({ ...pilotRunForm, status: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        {Object.entries(PILOT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">结果</label>
                      <select value={pilotRunForm.result} onChange={(e) => setPilotRunForm({ ...pilotRunForm, result: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm">
                        <option value="">选择结果</option>
                        {Object.entries(PILOT_RESULT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">计划日期</label>
                      <input type="date" value={pilotRunForm.plannedDate} onChange={(e) => setPilotRunForm({ ...pilotRunForm, plannedDate: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">完成日期</label>
                      <input type="date" value={pilotRunForm.completedDate} onChange={(e) => setPilotRunForm({ ...pilotRunForm, completedDate: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[var(--color-text-secondary)] mb-1">得率(%)</label>
                      <input type="number" value={pilotRunForm.yield} onChange={(e) => setPilotRunForm({ ...pilotRunForm, yield: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如 95" min="0" max="100" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                      <textarea value={pilotRunForm.remark} onChange={(e) => setPilotRunForm({ ...pilotRunForm, remark: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded text-sm" rows={2} placeholder="试产结果、工艺参数、注意事项等" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <button onClick={() => setShowPilotRunForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                    <button onClick={submitPilotRunForm} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm" disabled={!pilotRunForm.scale || !pilotRunForm.producer}>
                      {editPilotRunId ? '保存修改' : '创建'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: 成本核算 */}
        {activeTab === 'costings' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">成本核算</h2>
              <button onClick={() => router.push(`/rnd/costing`)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">查看全部</button>
            </div>

            {costings.length === 0 ? (
              <div className="bg-[var(--color-card)] rounded-xl border p-8 text-center text-[var(--color-text-secondary)] text-sm">暂无成本核算记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[var(--color-text-secondary)]">
                      <th className="text-left py-2 px-3">版本</th>
                      <th className="text-right py-2 px-3">总成本</th>
                      <th className="text-right py-2 px-3">单件成本</th>
                      <th className="text-right py-2 px-3">目标毛利率</th>
                      <th className="text-right py-2 px-3">建议售价</th>
                      <th className="text-right py-2 px-3">实际售价</th>
                      <th className="text-center py-2 px-3">状态</th>
                      <th className="text-right py-2 px-3">核算日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costings.map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-[var(--color-bg)]">
                        <td className="py-2 px-3">v{c.version}</td>
                        <td className="py-2 px-3 text-right">¥{c.totalCost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">¥{c.unitCost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{c.targetMargin !== null ? `${c.targetMargin}%` : '-'}</td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-700">¥{c.suggestedPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          {c.actualPrice !== null ? `¥${c.actualPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {c.status === 'DRAFT' ? '草稿' : '已定稿'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]">{formatDate(c.costingDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: 文件附件 */}
        {activeTab === 'files' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">文件附件</h2>
            </div>
            {files.length === 0 ? (
              <div className="bg-[var(--color-card)] rounded-xl border p-8 text-center text-[var(--color-text-secondary)] text-sm">暂无附件
                <p className="mt-2 text-xs">请在文件管理模块上传附件并通过 entityType=ProductDesign 关联到此产品</p>
              </div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border divide-y">
                {files.map((f) => {
                  const expiring = f.expireDate && new Date(f.expireDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  return (
                    <div key={f.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-[var(--color-text-secondary)] text-lg">📄</div>
                        <div>
                          <p className="text-sm font-medium">{f.originalName}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {f.fileType || '未分类'} · {(f.size / 1024).toFixed(1)} KB
                            {f.expireDate && <span className={`ml-2 ${expiring ? 'text-yellow-600' : ''}`}>到期: {formatDate(f.expireDate)}</span>}
                          </p>
                          {f.remark && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.remark}</p>}
                        </div>
                      </div>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs border rounded text-emerald-600 hover:bg-emerald-50">
                        查看
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
