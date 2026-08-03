'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import FileUploader from '@/components/FileUploader'
import ProcessTimeline from '@/components/ProcessTimeline'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const STATUS: Record<string, string> = {
  DRAFT: '草稿', FILING: '已提交申请', ACCEPTED: '已受理',
  PUBLISHED: '初审公告', OPPOSITION: '异议中', REGISTERED: '已注册',
  RENEWING: '续展中', EXPIRED: '已过期', REJECTED: '被驳回',
}
const TYPES: Record<string, string> = { WORD: '文字商标', FIGURE: '图形商标', COMBINED: '组合商标' }
const COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  FILING: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  PUBLISHED: 'bg-yellow-100 text-yellow-700',
  OPPOSITION: 'bg-red-100 text-red-600',
  REGISTERED: 'bg-green-100 text-green-700',
  RENEWING: 'bg-purple-100 text-purple-700',
  EXPIRED: 'bg-gray-100 text-gray-400',
  REJECTED: 'bg-red-100 text-red-700',
}

// 生命周期流转配置：每个状态允许的下一个状态
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['FILING'],
  FILING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PUBLISHED', 'OPPOSITION', 'REJECTED'],
  PUBLISHED: ['REGISTERED', 'OPPOSITION'],
  OPPOSITION: ['REGISTERED', 'REJECTED'],
  REGISTERED: ['RENEWING', 'EXPIRED'],
  RENEWING: ['REGISTERED', 'EXPIRED'],
  EXPIRED: ['RENEWING'],
  REJECTED: ['FILING'],
}

export default function TrademarkDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [approvalRequests, setApprovalRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [contracts, setContracts] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/api/assets/trademarks/${id}`)
    const json = await res.json()
    setData(json.trademark)
    setAuditLogs(json.auditLogs || [])
    setApprovalRequests(json.approvalRequests || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 获取可选的服务合同列表
  useEffect(() => {
    apiFetch('/api/service-contracts?limit=100')
      .then(r => r.json())
      .then(d => setContracts(d.contracts || []))
      .catch(() => {})
  }, [])

  const enterEditMode = () => {
    const t = data
    setEditForm({
      name: t.name,
      type: t.type,
      category: t.category,
      applicationNo: t.applicationNo || '',
      registrationNo: t.registrationNo || '',
      owner: t.owner,
      applyDate: t.applyDate ? t.applyDate.split('T')[0] : '',
      registerDate: t.registerDate ? t.registerDate.split('T')[0] : '',
      expireDate: t.expireDate ? t.expireDate.split('T')[0] : '',
      filingDate: t.filingDate ? t.filingDate.split('T')[0] : '',
      publicationDate: t.publicationDate ? t.publicationDate.split('T')[0] : '',
      registrationDate: t.registrationDate ? t.registrationDate.split('T')[0] : '',
      renewalDate: t.renewalDate ? t.renewalDate.split('T')[0] : '',
      agency: t.agency || '',
      agentContact: t.agentContact || '',
      fee: t.fee?.toString() || '',
      filingReceipt: t.filingReceipt || '',
      registrationCert: t.registrationCert || '',
      contractId: t.contractId || '',
      remark: t.remark || '',
    })
    setEditMode(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = { ...editForm }
    // 空格转 null
    for (const k in payload) {
      if (payload[k] === '') payload[k] = null
    }
    if (payload.fee) payload.fee = parseFloat(payload.fee)
    await apiFetch(`/api/assets/trademarks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setEditMode(false)
    fetchData()
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`确认将状态从「${STATUS[data.status]}」变更为「${STATUS[newStatus]}」？`)) return
    setSaving(true)
    await apiFetch(`/api/assets/trademarks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSaving(false)
    fetchData()
  }

  const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('zh-CN') : '-'

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>
  if (!data) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">商标不存在</div>

  const expireWarning = data.expireDate && new Date(data.expireDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const transitions = STATUS_TRANSITIONS[data.status] || []

  // 生命周期里程碑
  const timeline = [
    { label: '申请日', date: data.applyDate || data.filingDate, status: 'done' },
    { label: '受理', date: data.filingDate, status: data.status === 'DRAFT' ? 'pending' : 'done' },
    { label: '初审公告', date: data.publicationDate, status: ['PUBLISHED', 'OPPOSITION', 'REGISTERED', 'RENEWING', 'EXPIRED'].includes(data.status) ? 'done' : 'pending' },
    { label: '注册', date: data.registerDate || data.registrationDate, status: ['REGISTERED', 'RENEWING', 'EXPIRED'].includes(data.status) ? 'done' : 'pending' },
    { label: '续展', date: data.renewalDate, status: ['RENEWING'].includes(data.status) ? 'active' : 'pending' },
    { label: '到期', date: data.expireDate, status: data.status === 'EXPIRED' ? 'expired' : 'pending' },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/assets/trademarks')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{data.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[data.status] || ''}`}>{STATUS[data.status] || data.status}</span>
            {expireWarning && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">即将到期</span>}
          </div>
          <div className="flex items-center gap-2">
            {!editMode && (
              <button onClick={enterEditMode} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                编辑
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 业务流程进度（ProcessMilestone） */}
        <ProcessTimeline
          entityType="Trademark"
          entityId={data.id}
          presetStages={[
            { stage: 'CONTRACT_SIGNED', label: '签合同', sortOrder: 1 },
            { stage: 'FEE_PAID', label: '付款', sortOrder: 2 },
            { stage: 'APPLICATION_SUBMITTED', label: '提交申请', sortOrder: 3 },
            { stage: 'ACCEPTED', label: '已受理', sortOrder: 4 },
            { stage: 'PUBLISHED', label: '公告', sortOrder: 5 },
            { stage: 'REGISTERED', label: '已注册', sortOrder: 6 },
          ]}
        />

        {/* 状态流转 */}
        {transitions.length > 0 && !editMode && (
          <div className="bg-[var(--color-card)] rounded-xl border p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">状态流转</h2>
            <div className="flex flex-wrap gap-2">
              {transitions.map((nextStatus: string) => (
                <button
                  key={nextStatus}
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={saving}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    COLORS[nextStatus] || 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                  } hover:opacity-80 disabled:opacity-50`}
                >
                  → {STATUS[nextStatus] || nextStatus}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 基本信息 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">基本信息</h2>
          </div>
          {editMode ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">商标名称</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">类型</label>
                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                  <option value="WORD">文字商标</option>
                  <option value="FIGURE">图形商标</option>
                  <option value="COMBINED">组合商标</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">国际分类</label>
                <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
                  <option value="3">3类(化妆品)</option>
                  <option value="5">5类(医药)</option>
                  <option value="35">35类(广告销售)</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">申请号</label>
                <input type="text" value={editForm.applicationNo} onChange={e => setEditForm({ ...editForm, applicationNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">注册号</label>
                <input type="text" value={editForm.registrationNo} onChange={e => setEditForm({ ...editForm, registrationNo: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">权利人</label>
                <input type="text" value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">代理机构</label>
                <input type="text" value={editForm.agency} onChange={e => setEditForm({ ...editForm, agency: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">代理人及联系方式</label>
                <input type="text" value={editForm.agentContact} onChange={e => setEditForm({ ...editForm, agentContact: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-[var(--color-text-secondary)] mb-1">关联服务合同</label>
                <select value={editForm.contractId} onChange={e => setEditForm({ ...editForm, contractId: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm bg-[var(--color-card)]">
                  <option value="">— 不关联 —</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.name} - {c.contractor}</option>)}</select>
              </div>
              <div>
                <label className="block text-[var(--color-text-secondary)] mb-1">申请费用</label>
                <input type="number" value={editForm.fee} onChange={e => setEditForm({ ...editForm, fee: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
              <div className="col-span-3">
                <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
                <textarea value={editForm.remark} onChange={e => setEditForm({ ...editForm, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" rows={2} />
              </div>
              <div className="col-span-3 flex gap-2 justify-end pt-2">
                <button onClick={() => setEditMode(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-[var(--color-text-secondary)]">类型</span><p className="font-medium">{TYPES[data.type] || data.type}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">国际分类</span><p className="font-medium">第{data.category}类</p></div>
              <div><span className="text-[var(--color-text-secondary)]">申请号</span><p className="font-medium font-mono">{data.applicationNo || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">注册号</span><p className="font-medium font-mono">{data.registrationNo || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">权利人</span><p className="font-medium">{data.owner}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">代理机构</span><p className="font-medium">{data.agency || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">代理人</span><p className="font-medium">{data.agentContact || '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">申请费用</span><p className="font-medium">{data.fee != null ? `¥${data.fee.toLocaleString()}` : '-'}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">关联合同</span><p className="font-medium">{data.contractId ? contracts.find(c => c.id === data.contractId)?.name || "已关联" : "-"}</p></div>            </div>
          )}
        </div>

        {/* 关键日期 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">关键日期</h2>
          {editMode ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><label className="block text-[var(--color-text-secondary)] mb-1">申请日</label><input type="date" value={editForm.applyDate} onChange={e => setEditForm({ ...editForm, applyDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">受理日</label><input type="date" value={editForm.filingDate} onChange={e => setEditForm({ ...editForm, filingDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">初审公告日</label><input type="date" value={editForm.publicationDate} onChange={e => setEditForm({ ...editForm, publicationDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">注册日</label><input type="date" value={editForm.registrationDate} onChange={e => setEditForm({ ...editForm, registrationDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">注册证日期</label><input type="date" value={editForm.registerDate} onChange={e => setEditForm({ ...editForm, registerDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">续展日</label><input type="date" value={editForm.renewalDate} onChange={e => setEditForm({ ...editForm, renewalDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
              <div><label className="block text-[var(--color-text-secondary)] mb-1">有效期至</label><input type="date" value={editForm.expireDate} onChange={e => setEditForm({ ...editForm, expireDate: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-[var(--color-text-secondary)]">申请日</span><p className="font-medium">{formatDate(data.applyDate)}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">受理日</span><p className="font-medium">{formatDate(data.filingDate)}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">初审公告日</span><p className="font-medium">{formatDate(data.publicationDate)}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">注册日</span><p className="font-medium">{formatDate(data.registerDate || data.registrationDate)}</p></div>
              <div><span className="text-[var(--color-text-secondary)]">续展日</span><p className="font-medium">{formatDate(data.renewalDate)}</p></div>
              <div><span className={`text-[var(--color-text-secondary)]`}>有效期至</span><p className={`font-medium ${expireWarning ? 'text-red-500' : ''}`}>{formatDate(data.expireDate)}</p></div>
            </div>
          )}
        </div>

        {/* 申请费用 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">费用记录</h2>
          <div className="text-sm">
            <div className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg">
              <span className="text-[var(--color-text-secondary)]">申请费用</span>
              <span className="font-medium">{data.fee != null ? `¥${data.fee.toLocaleString()}` : '-'}</span>
            </div>
          </div>
        </div>

        {/* 关联产品 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">关联产品 ({data.productLinks?.length || 0})</h2>
          {data.productLinks?.length > 0 ? (
            <div className="space-y-2">
              {data.productLinks.map((link: any) => (
                <div key={link.productId} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg text-sm">
                  <span className="font-medium">{link.product.name}</span>
                  <span className="text-[var(--color-text-secondary)]">{link.product.brand || '-'} · {link.product.category || '-'}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无关联产品</p>}
        </div>

        {/* 附件 - 使用 FileUploader */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">附件文件</h2>
          <FileUploader entityType="Trademark" entityId={data.id} />
        </div>

        {/* 审批请求 */}
        {approvalRequests.length > 0 && (
          <div className="bg-[var(--color-card)] rounded-xl border p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">审批请求 ({approvalRequests.length})</h2>
            <div className="space-y-2">
              {approvalRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{req.title}</span>
                    <span className="ml-2 text-[var(--color-text-secondary)]">
                      {req.fromStatus ? `${STATUS[req.fromStatus] || req.fromStatus} → ` : ''}{STATUS[req.toStatus] || req.toStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {req.status === 'PENDING' ? '待审批' : req.status === 'APPROVED' ? '已批准' : '已拒绝'}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{req.createdAt ? new Date(req.createdAt).toLocaleString('zh-CN') : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 审计日志 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">审计日志 ({auditLogs.length})</h2>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      log.action === 'STATUS_CHANGE' ? 'bg-orange-100 text-orange-700' :
                      log.action === 'DELETE' ? 'bg-red-100 text-red-600' :
                      'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                    }`}>{log.action}</span>
                    <span className="text-[var(--color-text-secondary)]">{log.userName || log.userId}</span>
                    {log.detail && typeof log.detail === 'object' && log.detail.oldStatus && log.detail.newStatus && (
                      <span className="text-[var(--color-text-secondary)] text-xs">
                        {STATUS[log.detail.oldStatus] || log.detail.oldStatus} → {STATUS[log.detail.newStatus] || log.detail.newStatus}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">{log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无审计日志</p>}
        </div>
      </main>
    </div>
  )
}
