'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * 通用 API 查询 Hook
 *
 * 消除前端页面中重复的 fetch/useEffect 模板代码。
 *
 * 用法：
 * ```typescript
 * const { data, loading, refresh } = useList('/api/rnd/materials', { search: '甘油' })
 * const { data: material } = useDetail('/api/rnd/materials', id)
 * ```
 */

interface UseListOptions {
  /** 搜索关键词 */
  search?: string
  /** 过滤条件会拼接到 URL searchParams */
  [key: string]: any
}

interface ListResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  refresh: () => void
}

interface DetailResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

interface MutationOptions<T = any> {
  onSuccess?: (data: T) => void
  onError?: (err: string) => void
}

/**
 * 通用列表查询 Hook
 * GET /api/[module]?search=xxx&status=xxx&page=1&limit=20
 */
export function useList<T = any>(
  baseUrl: string,
  filters: UseListOptions = {},
  options: { paginate?: boolean; limit?: number } = {},
): ListResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (options.paginate !== false) {
        params.set('page', String(page))
        params.set('limit', String(options.limit || 20))
      }
      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val))
        }
      }
      const qs = params.toString()
      const url = qs ? `${baseUrl}?${qs}` : baseUrl
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '请求失败')
      }
      const json = await res.json()
      // 兼容 factory 格式和原始格式
      const key = Object.keys(json).find(k => k.endsWith('s')) || 'data'
      setData(Array.isArray(json[key]) ? json[key] : json.data || [])
      if (json.pagination) setPagination(json.pagination)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, JSON.stringify(filters), page, options.paginate, options.limit])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, pagination, refresh: fetchData }
}

/**
 * 通用详情查询 Hook
 * GET /api/[module]/?id=xxx
 */
export function useDetail<T = any>(
  baseUrl: string,
  id: string | null,
): DetailResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!id) { setData(null); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${baseUrl}/?id=${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '请求失败')
      }
      const json = await res.json()
      // 兼容 factory 格式
      const key = Object.keys(json).find(k => !k.endsWith('s')) || 'data'
      setData(json[key] || null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  return { data, loading, error, refresh: fetchDetail }
}

/**
 * 通用创建 Mutation
 * POST /api/[module]
 */
export function useCreate<T = any>(baseUrl: string, options: MutationOptions<T> = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (body: any) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '创建失败')
      const key = Object.keys(json).find(k => !k.endsWith('s')) || 'data'
      options.onSuccess?.(json[key] || json)
      return json[key] || json
    } catch (e: any) {
      setError(e.message)
      options.onError?.(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { create, loading, error }
}

/**
 * 通用更新 Mutation
 * PUT /api/[module]/[id]
 */
export function useUpdate<T = any>(baseUrl: string, options: MutationOptions<T> = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = async (id: string, body: any) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '更新失败')
      const key = Object.keys(json).find(k => !k.endsWith('s')) || 'data'
      options.onSuccess?.(json[key] || json)
      return json[key] || json
    } catch (e: any) {
      setError(e.message)
      options.onError?.(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { update, loading, error }
}

/**
 * 通用删除 Mutation
 * DELETE /api/[module]/[id]
 */
export function useDelete(baseUrl: string, options: MutationOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '删除失败')
      options.onSuccess?.(json)
      return true
    } catch (e: any) {
      setError(e.message)
      options.onError?.(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  return { remove, loading, error }
}
