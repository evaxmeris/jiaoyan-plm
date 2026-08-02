'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * useCrud — 通用 CRUD 页面状态管理 Hook
 *
 * 封装数据加载、创建/编辑弹窗控制、保存和删除的完整工作流，
 * 消除页面中重复的 fetch/useEffect/状态管理模板代码。
 *
 * 用法：
 * ```typescript
 * const { items, loading, openCreate, openEdit, handleSave, handleDelete, showForm, editingItem } =
 *   useCrud('/api/assets/trademarks')
 * ```
 *
 * @param endpoint  API 端点路径，如 '/api/assets/trademarks'
 *                  创建时 POST  到 endpoint
 *                  更新时 PUT   到 endpoint/{id}
 *                  删除时 DELETE 到 endpoint/{id}
 *                  查询时 GET   到 endpoint
 */
export function useCrud<T extends { id?: string }>(
  endpoint: string,
): {
  items: T[]
  loading: boolean
  openCreate: () => void
  openEdit: (item: T) => void
  handleSave: (data: Partial<T>) => Promise<void>
  handleDelete: (id: string) => Promise<void>
  showForm: boolean
  editingItem: T | null
} {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<T | null>(null)

  /** 加载数据列表 */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(endpoint)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      // 兼容 factory 格式和原始格式
      const key = Object.keys(json).find(k => k.endsWith('s')) || 'data'
      setItems(Array.isArray(json[key]) ? json[key] : json.data || [])
    } catch (e: any) {
      console.error('useCrud load error:', e.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { load() }, [load])

  /** 打开创建弹窗 */
  const openCreate = useCallback(() => {
    setEditingItem(null)
    setShowForm(true)
  }, [])

  /** 打开编辑弹窗 */
  const openEdit = useCallback((item: T) => {
    setEditingItem(item)
    setShowForm(true)
  }, [])

  /** 保存（创建或更新） */
  const handleSave = useCallback(
    async (data: Partial<T>) => {
      const isEdit = editingItem?.id != null
      const url = isEdit ? `${endpoint}/${editingItem!.id}` : endpoint
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '保存失败' }))
        throw new Error(err.error || '保存失败')
      }

      setShowForm(false)
      setEditingItem(null)
      await load()
    },
    [endpoint, editingItem, load],
  )

  /** 删除 */
  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '删除失败' }))
        throw new Error(err.error || '删除失败')
      }
      await load()
    },
    [endpoint, load],
  )

  return {
    items,
    loading,
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    showForm,
    editingItem,
  }
}
