'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, RefreshCw } from 'lucide-react'
import FileUploader, { type FileUploaderHandle } from '@/components/FileUploader'
import { useToast } from '@/components/Toast'
import PageHeader from '@/components/PageHeader'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'
import { MATERIAL_DOC_TYPES } from '@/lib/material-doc-types'

// 备案状态徽标
const STATUS_META: Record<string, { label: string; cls: string }> = {
  UNRECORDED: { label: '未备案', cls: 'bg-gray-100 text-gray-600' },
  RECORDING: { label: '备案中', cls: 'bg-yellow-100 text-yellow-700' },
  RECORDED: { label: '已备案', cls: 'bg-green-100 text-green-700' },
  EXPIRED: { label: '已过期', cls: 'bg-red-100 text-red-700' },
}

interface RawMaterialDetail {
  id: string
  nameCn: string
  nameEn: string | null
  inciName: string | null
  casNo: string | null
  filingNo: string | null
  filingCode: string | null
  latestPrice: number | null
  filingStatus: string
  filingExpireDate: string | null
  supplier: string | null
  supplierId: string | null
  function: string | null
  specification: string | null
  unit: string
  currentStock: number
  minStock: number
  limitChina: string | null
  limitEu: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

const EMPTY_FORM = {
  nameCn: '', nameEn: '', inciName: '', casNo: '',
  filingNo: '', filingStatus: 'UNRECORDED', filingExpireDate: '',
  filingCode: '', latestPrice: '',
  supplier: '', function: '', specification: '', unit: 'kg',
  limitChina: '', limitEu: '', remark: '',
}

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [material, setMaterial] = useState<RawMaterialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // 供应商下拉数据源（name → id）
  const [supplierOptions, setSupplierOptions] = useState<{ id: string; name: string }[]>([])
  // 各文档类型区块的 FileUploader 句柄（标题行图标调用上传/刷新）
  const uploaderRefs = useRef<Record<string, FileUploaderHandle | null>>({})

  const fetchMaterial = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/rnd/materials/?id=${id}`)
      if (!res.ok) throw new Error('加载失败')
      const json = await res.json()
      const m = json.data || json.rawMaterial || null
      setMaterial(m)
      if (m) {
        setForm({
          nameCn: m.nameCn || '', nameEn: m.nameEn || '', inciName: m.inciName || '',
          casNo: m.casNo || '', filingNo: m.filingNo || '',
          filingCode: m.filingCode || '', latestPrice: m.latestPrice != null ? String(m.latestPrice) : '',
          filingStatus: m.filingStatus || 'UNRECORDED',
          filingExpireDate: m.filingExpireDate ? String(m.filingExpireDate).slice(0, 10) : '',
          supplier: m.supplier || '', function: m.function || '',
          specification: m.specification || '', unit: m.unit || 'kg',
          limitChina: m.limitChina || '', limitEu: m.limitEu || '',
          remark: m.remark || '',
        })
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) showToast('error', e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id, showToast])

  // 供应商下拉数据源
  useEffect(() => {
    apiFetch('/api/supply/suppliers?limit=200')
      .then(r => r.json())
      .then(json => {
        const items = json.data || json.suppliers || []
        setSupplierOptions(items.map((s: any) => ({ id: s.id, name: s.name })))
      })
      .catch(() => { /* 下拉失败不阻塞页面 */ })
  }, [])

  useEffect(() => { fetchMaterial() }, [fetchMaterial])

  const handleSave = async () => {
    if (!form.nameCn.trim()) { showToast('error', '原料中文名不能为空'); return }
    setSaving(true)
    try {
      // 供应商匹配：下拉选中或手填名字，若与已有供应商同名则带 supplierId
      const matched = supplierOptions.find(s => s.name === form.supplier.trim())
      const res = await apiFetch(`/api/rnd/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameCn: form.nameCn.trim(),
          nameEn: form.nameEn.trim() || null,
          inciName: form.inciName.trim() || null,
          casNo: form.casNo.trim() || null,
          filingNo: form.filingNo.trim() || null,
          filingCode: form.filingCode.trim() || null,
          latestPrice: form.latestPrice ? Number(form.latestPrice) : null,
          filingStatus: form.filingStatus,
          filingExpireDate: form.filingExpireDate ? new Date(form.filingExpireDate) : null,
          supplier: form.supplier.trim() || null,
          supplierId: matched?.id || null,
          function: form.function.trim() || null,
          specification: form.specification.trim() || null,
          unit: form.unit || 'kg',
          limitChina: form.limitChina.trim() || null,
          limitEu: form.limitEu.trim() || null,
          remark: form.remark.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '保存失败')
      showToast('success', '保存成功')
      setEditing(false)
      fetchMaterial()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) showToast('error', e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="w-full mx-auto px-4 md:px-6 py-6 space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!material) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center gap-4">
        <div className="text-[var(--color-text-secondary)]">原料不存在或已被删除</div>
        <button onClick={() => router.push('/rnd/materials')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
          返回原料库
        </button>
      </div>
    )
  }

  const status = STATUS_META[material.filingStatus] || STATUS_META.UNRECORDED
  const field = (label: string, value: string | null | undefined) => (
    <div>
      <div className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</div>
      <div className="font-medium text-sm break-words">{value || '-'}</div>
    </div>
  )

  // 编辑模式的输入框
  const inputCls = "w-full px-3 py-1.5 border border-[var(--color-border)] rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
  const editInput = (key: keyof typeof EMPTY_FORM, label: string, required = false) => (
    <div>
      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{label}{required && ' *'}</label>
      <input
        type="text"
        value={(form as any)[key] || ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className={inputCls}
        required={required}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4">
          <button onClick={() => router.push('/rnd/materials')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] mb-3 inline-block">
            &larr; 返回原料库
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader title={material.nameCn} />
              {material.supplier && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  🏭 {material.supplier}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.cls}`}>{status.label}</span>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setForm({
                    nameCn: material.nameCn || '', nameEn: material.nameEn || '', inciName: material.inciName || '',
                    casNo: material.casNo || '', filingNo: material.filingNo || '',
                    filingCode: material.filingCode || '', latestPrice: material.latestPrice != null ? String(material.latestPrice) : '',
                    filingStatus: material.filingStatus || 'UNRECORDED',
                    filingExpireDate: material.filingExpireDate ? String(material.filingExpireDate).slice(0, 10) : '',
                    supplier: material.supplier || '', function: material.function || '',
                    specification: material.specification || '', unit: material.unit || 'kg',
                    limitChina: material.limitChina || '', limitEu: material.limitEu || '',
                    remark: material.remark || '',
                  }) }} className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">
                    取消
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? '保存中...' : '保存修改'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  编辑
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in space-y-6">
        {/* ===== 区块一：基本信息 ===== */}
        <section className="bg-[var(--color-card)] rounded-xl border p-4 md:p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
            基本信息
          </h2>

          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 text-sm">
              {editInput('nameCn', 'INCI 中文名', true)}
              {editInput('nameEn', 'INCI 英文名')}
              {editInput('inciName', 'INCI 名(规范)')}
              {editInput('casNo', 'CAS 号')}
              {editInput('filingNo', '备案码')}
              {editInput('filingCode', '原料报送码')}
              {editInput('latestPrice', '采购单价 (元/kg)')}
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">备案状态</label>
                <select
                  value={form.filingStatus}
                  onChange={e => setForm({ ...form, filingStatus: e.target.value })}
                  className={inputCls}
                >
                  <option value="UNRECORDED">未备案</option>
                  <option value="RECORDING">备案中</option>
                  <option value="RECORDED">已备案</option>
                  <option value="EXPIRED">已过期</option>
                </select>
              </div>
              {editInput('filingExpireDate', '备案有效期')}
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">厂家/供应商</label>
                <input
                  list="material-supplier-list"
                  value={form.supplier}
                  onChange={e => setForm({ ...form, supplier: e.target.value })}
                  className={inputCls}
                  placeholder="选择已有厂家或直接输入新厂家名"
                />
                <datalist id="material-supplier-list">
                  {supplierOptions.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  支持从供应商库选择，或直接输入新厂家名（自动创建关联）
                </p>
              </div>
              {editInput('function', '功能分类')}
              {editInput('specification', '规格参数')}
              {editInput('unit', '单位')}
              {editInput('limitChina', '中国限量')}
              {editInput('limitEu', '欧盟限量')}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">备注</label>
                <textarea
                  value={form.remark}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                  className={inputCls}
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 text-sm">
              {field('INCI 中文名', material.nameCn)}
              {field('INCI 英文名', material.nameEn)}
              {field('INCI 名(规范)', material.inciName)}
              {field('CAS 号', material.casNo)}
              {field('备案码', material.filingNo)}
              {field('原料报送码', material.filingCode)}
              {field('采购单价', material.latestPrice != null ? `¥${material.latestPrice}${material.unit ? '/' + material.unit : ''}` : null)}
              {field('备案有效期', material.filingExpireDate ? String(material.filingExpireDate).slice(0, 10) : null)}
              {field('厂家/供应商', material.supplier)}
              {field('功能分类', material.function)}
              {field('规格参数', material.specification)}
              {field('单位', material.unit)}
              {field('中国限量', material.limitChina)}
              {field('欧盟限量', material.limitEu)}
              {field('当前库存', `${material.currentStock} ${material.unit}`)}
              {field('库存预警线', `${material.minStock} ${material.unit}`)}
              {field('备注', material.remark)}
            </div>
          )}
        </section>

        {/* ===== 区块一.五：价格历史 ===== */}
        <section className="bg-[var(--color-card)] rounded-xl border p-4 md:p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
              价格历史
            </h2>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            当前价 ¥{material.latestPrice ?? '未设置'}/{material.unit}。价格手动调整或采购收货时，旧价自动沉淀为历史。
          </p>
          <PriceHistory rawMaterialId={material.id} />
        </section>

        {/* ===== 区块二：厂家资料 ===== */}
        <section className="bg-[var(--color-card)] rounded-xl border p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
              厂家资料
            </h2>
            {material.supplier && (
              <span className="text-xs text-[var(--color-text-secondary)]">供应商：{material.supplier}</span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            该厂家随料提供的资质文件，随料归档，便于查阅追溯。直接在上传区点击或拖拽文件即可。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MATERIAL_DOC_TYPES.map(doc => (
              <div key={doc.type} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <div className="px-4 pt-3 pb-2 bg-[var(--color-bg)]/50 border-b border-[var(--color-border)] flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{doc.label}</div>
                    <div className="text-[11px] text-[var(--color-text-secondary)]">{doc.hint}</div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      title="上传文件（可拖拽到此处）"
                      onClick={() => uploaderRefs.current[doc.type]?.triggerUpload()}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="刷新"
                      onClick={() => uploaderRefs.current[doc.type]?.refresh()}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <FileUploader
                  ref={el => { uploaderRefs.current[doc.type] = el }}
                  entityType="RawMaterial"
                  entityId={material.id}
                  fileTypeFilter={doc.type}
                  uploadFileType={doc.type}
                  compact
                  hideHeader
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// 价格历史列表（该原料行的价格变动记录）
function PriceHistory({ rawMaterialId }: { rawMaterialId: string }) {
  const [histories, setHistories] = useState<{
    id: string
    price: number
    unit: string
    supplier: string | null
    purchaseOrderNo: string | null
    remark: string | null
    recordedAt: string
  }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/rnd/materials/${rawMaterialId}/price-history`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        const data = json.data || {}
        setHistories(data.histories || [])
      })
      .catch(() => { /* 历史加载失败不阻塞页面 */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [rawMaterialId])

  if (loading) return <div className="skeleton h-16 w-full" />

  if (histories.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-secondary)] py-6 text-center border border-dashed border-[var(--color-border)] rounded-lg">
        暂无价格历史 — 手动调整价格或采购收货后自动记录
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
            <th className="py-2 pr-3 font-medium">日期</th>
            <th className="py-2 pr-3 font-medium">价格</th>
            <th className="py-2 pr-3 font-medium">来源</th>
            <th className="py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>
          {histories.map(h => (
            <tr key={h.id} className="border-b border-[var(--color-border)] last:border-0">
              <td className="py-2 pr-3 whitespace-nowrap">
                {new Date(h.recordedAt).toLocaleDateString('zh-CN')}
              </td>
              <td className="py-2 pr-3 font-medium">¥{h.price}/{h.unit}</td>
              <td className="py-2 pr-3">
                {h.purchaseOrderNo ? (
                  <span className="text-blue-600 text-xs">PO {h.purchaseOrderNo}</span>
                ) : (
                  <span className="text-xs text-[var(--color-text-secondary)]">手动调整</span>
                )}
              </td>
              <td className="py-2 text-xs text-[var(--color-text-secondary)]">{h.remark || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
