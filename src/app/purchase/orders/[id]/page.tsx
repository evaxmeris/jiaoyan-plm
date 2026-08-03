'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  ISSUED: '已发出',
  CONFIRMED: '已确认',
  PARTIAL: '部分到货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-500',
}

// 每个状态可进行的操作
const STATUS_ACTIONS: Record<string, { label: string; nextStatus: string; color: string }[]> = {
  DRAFT: [
    { label: '发出PO', nextStatus: 'ISSUED', color: 'bg-blue-500 hover:bg-blue-600' },
    { label: '取消', nextStatus: 'CANCELLED', color: 'bg-red-400 hover:bg-red-500' },
  ],
  ISSUED: [
    { label: '供应商已确认', nextStatus: 'CONFIRMED', color: 'bg-green-500 hover:bg-green-600' },
    { label: '取消', nextStatus: 'CANCELLED', color: 'bg-red-400 hover:bg-red-500' },
  ],
  CONFIRMED: [
    { label: '📦 到货登记', nextStatus: '__RECEIVE__', color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: '取消', nextStatus: 'CANCELLED', color: 'bg-red-400 hover:bg-red-500' },
  ],
  PARTIAL: [
    { label: '📦 到货登记', nextStatus: '__RECEIVE__', color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: '取消', nextStatus: 'CANCELLED', color: 'bg-red-400 hover:bg-red-500' },
  ],
  COMPLETED: [],
  CANCELLED: [],
}

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null)

  // 到货登记弹窗状态
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [receiveForm, setReceiveForm] = useState<Record<string, string>>({})
  const [receiveSubmitting, setReceiveSubmitting] = useState(false)
  const [receiveError, setReceiveError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/api/purchase/orders/${id}`)
    const json = await res.json()
    setData(json.data || json)
    setAuditLogs(json.auditLogs || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  const handleStatusChange = async (status: string) => {
    // 到货登记特殊处理：打开弹窗
    if (status === '__RECEIVE__') {
      // 初始化收货表单
      const initial: Record<string, string> = {}
      for (const item of (data?.items || [])) {
        initial[item.id] = ''
      }
      setReceiveForm(initial)
      setReceiveError(null)
      setShowReceiveModal(true)
      setConfirmStatus(null)
      return
    }

    const res = await apiFetch(`/api/purchase/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || '操作失败')
      return
    }
    setConfirmStatus(null)
    fetchData()
  }

  const handleReceive = async () => {
    setReceiveError(null)

    // 构建提交数据：只包含填了数量的行
    const items: { itemId: string; receivedQty: number }[] = []
    for (const item of (data?.items || [])) {
      const val = receiveForm[item.id]
      if (val !== undefined && val !== '') {
        const qty = parseFloat(val)
        if (isNaN(qty) || qty < 0) {
          setReceiveError(`「${item.name}」收货数量无效`)
          return
        }
        if (qty === 0) continue
        items.push({ itemId: item.id, receivedQty: qty })
      }
    }

    if (items.length === 0) {
      setReceiveError('请至少填写一项收货数量')
      return
    }

    setReceiveSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase/orders/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok) {
        setReceiveError(json.error || '操作失败')
        setReceiveSubmitting(false)
        return
      }
      setShowReceiveModal(false)
      setReceiveSubmitting(false)
      fetchData()
    } catch {
      setReceiveError('网络错误')
      setReceiveSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">加载中...</div>
  if (!data) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-secondary)]">采购订单不存在</div>

  const availableActions = STATUS_ACTIONS[data.status] || []

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/purchase/orders')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)] font-mono">{data.poNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[data.status] || ''}`}>
              {STATUS_LABELS[data.status] || data.status}
            </span>
          </div>
          {/* 状态流转按钮 */}
          {availableActions.length > 0 && (
            <div className="flex gap-2">
              {availableActions.map(action => (
                <button
                  key={action.nextStatus}
                  onClick={() => setConfirmStatus(action.nextStatus)}
                  className={`px-4 py-2 text-sm text-white rounded-lg ${action.color}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 基本信息 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">基本信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-[var(--color-text-secondary)]">PO编号</span>
              <p className="font-medium font-mono">{data.poNo}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">供应商</span>
              <p className="font-medium">{data.supplierName || '-'}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">订单总额</span>
              <p className="font-medium text-rose-600">¥{data.totalAmount?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">关联采购申请</span>
              <p className="font-medium">
                {data.application ? (
                  <button
                    onClick={() => router.push(`/purchase/${data.application.id}`)}
                    className="text-emerald-600 hover:text-emerald-700 underline"
                  >
                    {data.application.code} - {data.application.title}
                  </button>
                ) : '-'}
              </p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">创建时间</span>
              <p className="font-medium">{new Date(data.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">发出时间</span>
              <p className="font-medium">{data.issuedAt ? new Date(data.issuedAt).toLocaleString('zh-CN') : '-'}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">确认时间</span>
              <p className="font-medium">{data.confirmedAt ? new Date(data.confirmedAt).toLocaleString('zh-CN') : '-'}</p>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">完成时间</span>
              <p className="font-medium">{data.completedAt ? new Date(data.completedAt).toLocaleString('zh-CN') : '-'}</p>
            </div>
          </div>
          {data.remark && (
            <div className="mt-4 p-3 bg-[var(--color-bg)] rounded-lg text-sm text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-secondary)]">备注：</span>{data.remark}
            </div>
          )}
        </div>

        {/* 物品清单 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
            物品清单 ({data.items?.length || 0})
          </h2>
          {(data.items || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)] border-b">
                    <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">名称</th>
                    <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium">订购数量</th>
                    <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium">已收货</th>
                    <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">单位</th>
                    <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium">单价</th>
                    <th className="text-right px-4 py-2 text-[var(--color-text-secondary)] font-medium">小计</th>
                    <th className="text-left px-4 py-2 text-[var(--color-text-secondary)] font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((item: any) => {
                    const received = Number(item.receivedQty) || 0
                    const ordered = Number(item.quantity)
                    const remaining = ordered - received
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-right">{ordered}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={received >= ordered ? 'text-emerald-600 font-medium' : 'text-orange-500'}>
                            {received}
                            {received > 0 && received < ordered && <span className="text-xs text-[var(--color-text-secondary)] ml-1">/{remaining}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.unit}</td>
                        <td className="px-4 py-3 text-right">¥{Number(item.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium">¥{Number(item.totalPrice).toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{item.remark || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--color-bg)] font-medium">
                    <td colSpan={5} className="px-4 py-2 text-right text-[var(--color-text-secondary)]">合计</td>
                    <td className="px-4 py-2 text-right text-rose-600">¥{data.totalAmount?.toFixed(2) || '0.00'}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无明细</p>}
        </div>

        {/* 审计日志 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">操作日志 ({auditLogs.length})</h2>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                      log.action === 'STATUS_CHANGE' ? 'bg-orange-100 text-orange-700' :
                      log.action === 'RECEIVE' ? 'bg-emerald-100 text-emerald-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      'bg-[var(--color-card)] text-[var(--color-text-secondary)]'
                    }`}>{log.action}</span>
                    <span className="text-[var(--color-text-secondary)]">{log.userName || log.userId}</span>
                    {log.detail?.from && log.detail?.to && (
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {STATUS_LABELS[log.detail.from] || log.detail.from} → {STATUS_LABELS[log.detail.to] || log.detail.to}
                      </span>
                    )}
                    {log.action === 'RECEIVE' && log.detail?.receivedItems && (
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        收货 {log.detail.receivedItems.map((ri: any) => `${ri.name}×${ri.qty}`).join('、')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-secondary)]">暂无操作日志</p>}
        </div>
      </main>

      {/* 确认弹窗（状态变更） */}
      {confirmStatus && confirmStatus !== '__RECEIVE__' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfirmStatus(null)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">确认操作</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              确认将状态变更为「{STATUS_LABELS[confirmStatus] || confirmStatus}」？
              {confirmStatus === 'COMPLETED' && (
                <span className="block mt-2 text-orange-600">⚠ 完成后将自动入库，此操作不可逆</span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmStatus(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">取消</button>
              <button
                onClick={() => handleStatusChange(confirmStatus)}
                className="px-4 py-2 text-sm rounded-lg text-white bg-emerald-500 hover:bg-emerald-600"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 到货登记弹窗 */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowReceiveModal(false)}>
          <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">📦 到货登记</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">填写本次实际到货数量。系统将自动更新库存和订单状态。</p>

            {receiveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {receiveError}
              </div>
            )}

            <div className="space-y-3">
              {(data?.items || []).map((item: any) => {
                const ordered = Number(item.quantity)
                const received = Number(item.receivedQty) || 0
                const remaining = ordered - received
                const isComplete = received >= ordered
                return (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-[var(--color-bg)] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        订购 {ordered} {item.unit}
                        {received > 0 && <span className="ml-2">已收 {received}</span>}
                        {remaining > 0 && <span className="ml-2 text-orange-500">待收 {remaining}</span>}
                        {isComplete && <span className="ml-2 text-emerald-600">✓ 已收齐</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        step="any"
                        placeholder={isComplete ? '已收齐' : `本次收货`}
                        disabled={isComplete}
                        value={receiveForm[item.id] ?? ''}
                        onChange={e => setReceiveForm(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-28 px-3 py-1.5 text-sm border rounded-lg bg-[var(--color-card)] text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs text-[var(--color-text-secondary)] w-8">{item.unit}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                disabled={receiveSubmitting}
              >
                取消
              </button>
              <button
                onClick={handleReceive}
                disabled={receiveSubmitting}
                className="px-4 py-2 text-sm rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {receiveSubmitting ? '提交中...' : '确认收货'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
