'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface WarehouseZone {
  id: string
  name: string
  description: string | null
  remark: string | null
  _count?: { locations: number }
  locations?: { id: string; code: string; isOccupied: boolean }[]
}

interface WarehouseLocation {
  id: string
  zoneId: string
  code: string
  description: string | null
  isOccupied: boolean
  remark: string | null
  zone?: { id: string; name: string }
}

const defaultZoneForm = { id: '', name: '', description: '', remark: '' }
const defaultLocationForm = { id: '', zoneId: '', code: '', description: '', isOccupied: false, remark: '' }

export default function WarehousePage() {
  const [zones, setZones] = useState<WarehouseZone[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [loadingLocations, setLoadingLocations] = useState(false)

  // Zone form state
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [zoneForm, setZoneForm] = useState(defaultZoneForm)
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null)

  // Location form state
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locationForm, setLocationForm] = useState(defaultLocationForm)
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')

  const router = useRouter()
  const { showToast } = useToast()

  const fetchZones = useCallback(async () => {
    setLoadingZones(true)
    const res = await apiFetch('/api/logistics/warehouses/zones', { credentials: 'include' })
    const data = await res.json()
    if (res.ok) setZones(data.data || [])
    setLoadingZones(false)
  }, [])

  const fetchLocations = useCallback(async (zoneId?: string) => {
    setLoadingLocations(true)
    const params = zoneId ? `?zoneId=${zoneId}` : ''
    const res = await apiFetch(`/api/logistics/warehouses/locations${params}`, { credentials: 'include' })
    const data = await res.json()
    if (res.ok) setLocations(data.data || [])
    setLoadingLocations(false)
  }, [])

  useEffect(() => { fetchZones(); fetchLocations() }, [fetchZones, fetchLocations])

  useEffect(() => {
    if (selectedZoneId) {
      fetchLocations(selectedZoneId)
    }
  }, [selectedZoneId, fetchLocations])

  // ── Zone CRUD ──

  const openZoneCreate = () => {
    setZoneForm(defaultZoneForm)
    setShowZoneForm(true)
  }

  const openZoneEdit = (z: WarehouseZone) => {
    setZoneForm({ id: z.id, name: z.name, description: z.description || '', remark: z.remark || '' })
    setShowZoneForm(true)
  }

  const handleZoneSave = async () => {
    if (!zoneForm.name) {
      showToast('error', '区域名称不能为空')
      return
    }
    const url = '/api/logistics/warehouses/zones'
    const method = zoneForm.id ? 'PUT' : 'POST'
    const body = zoneForm.id ? zoneForm : { name: zoneForm.name, description: zoneForm.description, remark: zoneForm.remark }
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
    if (res.ok) {
      setShowZoneForm(false)
      setZoneForm(defaultZoneForm)
      fetchZones()
      showToast('success', zoneForm.id ? '区域已更新' : '区域已创建')
    } else {
      const data = await res.json()
      showToast('error', data.error || '保存失败')
    }
  }

  const confirmDeleteZone = async () => {
    if (!deleteZoneId) return
    const res = await apiFetch(`/api/logistics/warehouses/zones?id=${deleteZoneId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    } else {
      showToast('success', '区域已删除')
    }
    setDeleteZoneId(null)
    fetchZones()
    fetchLocations()
  }

  // ── Location CRUD ──

  const openLocationCreate = (zoneId?: string) => {
    setLocationForm({ ...defaultLocationForm, zoneId: zoneId || (zones[0]?.id || '') })
    setShowLocationForm(true)
  }

  const openLocationEdit = (l: WarehouseLocation) => {
    setLocationForm({
      id: l.id,
      zoneId: l.zoneId,
      code: l.code,
      description: l.description || '',
      isOccupied: l.isOccupied,
      remark: l.remark || '',
    })
    setShowLocationForm(true)
  }

  const handleLocationSave = async () => {
    if (!locationForm.zoneId || !locationForm.code) {
      showToast('error', '区域和仓位编码不能为空')
      return
    }
    const url = '/api/logistics/warehouses/locations'
    const method = locationForm.id ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(locationForm),
      credentials: 'include',
    })
    if (res.ok) {
      setShowLocationForm(false)
      setLocationForm(defaultLocationForm)
      fetchZones()
      if (selectedZoneId) fetchLocations(selectedZoneId)
      showToast('success', locationForm.id ? '仓位已更新' : '仓位已创建')
    } else {
      const data = await res.json()
      showToast('error', data.error || '保存失败')
    }
  }

  const confirmDeleteLocation = async () => {
    if (!deleteLocationId) return
    const res = await apiFetch(`/api/logistics/warehouses/locations?id=${deleteLocationId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      const err = await res.json()
      showToast('error', err.error || '删除失败')
    } else {
      showToast('success', '仓位已删除')
    }
    setDeleteLocationId(null)
    fetchZones()
    if (selectedZoneId) fetchLocations(selectedZoneId)
  }

  const handleToggleOccupied = async (l: WarehouseLocation) => {
    const res = await apiFetch('/api/logistics/warehouses/locations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, isOccupied: !l.isOccupied }),
      credentials: 'include',
    })
    if (res.ok) {
      fetchZones()
      if (selectedZoneId) fetchLocations(selectedZoneId)
    } else {
      const data = await res.json()
      showToast('error', data.error || '操作失败')
    }
  }

  // ── Zone form modal ──
  const renderZoneForm = () => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowZoneForm(false)}>
      <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{zoneForm.id ? '编辑仓位区域' : '新增仓位区域'}</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">区域名称 *</label>
            <input type="text" value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：A区、常温库、冷藏库" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">区域描述</label>
            <input type="text" value={zoneForm.description} onChange={e => setZoneForm({ ...zoneForm, description: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：常温原料存储区" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
            <input type="text" value={zoneForm.remark} onChange={e => setZoneForm({ ...zoneForm, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={() => setShowZoneForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
          <button onClick={handleZoneSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">{zoneForm.id ? '保存' : '新增'}</button>
        </div>
      </div>
    </div>
  )

  // ── Location form modal ──
  const renderLocationForm = () => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowLocationForm(false)}>
      <div className="bg-[var(--color-card)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{locationForm.id ? '编辑仓位' : '新增仓位'}</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">所属区域 *</label>
            <select value={locationForm.zoneId} onChange={e => setLocationForm({ ...locationForm, zoneId: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm">
              <option value="">选择区域</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">仓位编码 *</label>
            <input type="text" value={locationForm.code} onChange={e => setLocationForm({ ...locationForm, code: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：A-01、A-02" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">仓位描述</label>
            <input type="text" value={locationForm.description} onChange={e => setLocationForm({ ...locationForm, description: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" placeholder="如：左排中层" />
          </div>
          <div>
            <label className="block text-[var(--color-text-secondary)] mb-1">备注</label>
            <input type="text" value={locationForm.remark} onChange={e => setLocationForm({ ...locationForm, remark: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={locationForm.isOccupied} onChange={e => setLocationForm({ ...locationForm, isOccupied: e.target.checked })} className="rounded" />
              <span className="text-sm">已占用</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={() => setShowLocationForm(false)} className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">取消</button>
          <button onClick={handleLocationSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">{locationForm.id ? '保存' : '新增'}</button>
        </div>
      </div>
    </div>
  )

  // 选中区域的所有仓位（含来自zone详情或独立获取）
  const selectedLocations = selectedZoneId
    ? locations.filter(l => l.zoneId === selectedZoneId)
    : locations

  const getOccupiedCount = (zoneId: string) => {
    if (!selectedZoneId || selectedZoneId !== zoneId) {
      const zone = zones.find(z => z.id === zoneId)
      return zone?.locations?.filter(l => l.isOccupied).length || 0
    }
    return selectedLocations.filter(l => l.isOccupied).length
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/logistics/shipping')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回物流</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">仓区位管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openLocationCreate()} className="px-3 py-2 border rounded-lg text-sm hover:bg-[var(--color-bg)]">
              + 新增仓位
            </button>
            <button onClick={openZoneCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
              + 新增区域
            </button>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 区域列表 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">仓位区域</h2>
          {loadingZones ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>
          ) : zones.length === 0 ? (
            <div className="empty-state py-8">
              <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <div className="empty-state-title">暂无仓位区域</div>
              <div className="empty-state-desc">点击右上角"新增区域"创建仓库区域</div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {zones.map(z => {
                const total = z._count?.locations || z.locations?.length || 0
                const occupied = getOccupiedCount(z.id)
                return (
                  <div
                    key={z.id}
                    className={`bg-[var(--color-card)] rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm ${
                      selectedZoneId === z.id ? 'border-emerald-400 ring-1 ring-emerald-200' : ''
                    }`}
                    onClick={() => setSelectedZoneId(selectedZoneId === z.id ? '' : z.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{z.name}</div>
                        {z.description && <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{z.description}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openZoneEdit(z) }} className="px-2 py-1 rounded text-xs border text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteZoneId(z.id) }} className="px-2 py-1 rounded text-xs border text-red-500 hover:bg-red-50">删除</button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-[var(--color-text-secondary)]">
                      <span>总仓位：{total}</span>
                      <span className="text-amber-600">已占用：{occupied}</span>
                      <span className="text-emerald-600">空闲：{total - occupied}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 选中的区域仓位详情 */}
        {selectedZoneId && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                仓位明细 — {zones.find(z => z.id === selectedZoneId)?.name || ''}
              </h2>
              <button onClick={() => openLocationCreate(selectedZoneId)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-[var(--color-bg)]">
                + 新增仓位
              </button>
            </div>
            {loadingLocations ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton h-12 w-full" />)}</div>
            ) : selectedLocations.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
                该区域暂无仓位，点击"新增仓位"添加
              </div>
            ) : (
              <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="border-b bg-[var(--color-bg)]">
                      <th className="text-left px-4 py-2 font-medium whitespace-nowrap">编码</th>
                      <th className="text-left px-4 py-2 font-medium">描述</th>
                      <th className="text-left px-4 py-2 font-medium whitespace-nowrap">状态</th>
                      <th className="text-center px-4 py-2 font-medium whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLocations.map(l => (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                        <td className="px-4 py-2.5 font-mono font-medium whitespace-nowrap">{l.code}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-secondary)] max-w-[160px] truncate" title={l.description || '-'}>{l.description || '-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleOccupied(l)}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              l.isOccupied
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            {l.isOccupied ? '已占用' : '空闲'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openLocationEdit(l)} className="px-2 py-1 rounded text-xs border text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">编辑</button>
                            <button onClick={() => setDeleteLocationId(l.id)} className="px-2 py-1 rounded text-xs border text-red-500 hover:bg-red-50">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {showZoneForm && renderZoneForm()}
      {showLocationForm && renderLocationForm()}

      <ConfirmDialog open={deleteZoneId !== null} title="确认删除" message="确定要删除此区域吗？区域下的所有仓位也将被删除。" confirmLabel="删除" onConfirm={confirmDeleteZone} onCancel={() => setDeleteZoneId(null)} />
      <ConfirmDialog open={deleteLocationId !== null} title="确认删除" message="确定要删除此仓位吗？" confirmLabel="删除" onConfirm={confirmDeleteLocation} onCancel={() => setDeleteLocationId(null)} />
    </div>
  )
}
