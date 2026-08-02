'use client'

import { useState, useEffect } from 'react'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  department: string | null
}

const TOKEN_KEY = 'jy_token'

/**
 * 从 JWT cookie + localStorage 双重获取当前登录用户信息
 * localStorage 用于 cpolar 隧道等反代场景（cookie 可能丢失）
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const headers: Record<string, string> = {}
      // 尝试从 localStorage 读取 token 作为后备
      const localToken = localStorage.getItem(TOKEN_KEY)
      if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`
      }
      const res = await fetch('/api/auth/me', { headers })
      if (res.ok) {
        const data = await res.json()
        setUser((data as any).data?.user || data.user)
        // 如果 API 返回了新 token，存到 localStorage
        if ((data as any).data?.token) {
          localStorage.setItem(TOKEN_KEY, (data as any).data.token)
        }
      } else {
        setUser(null)
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  /** 保存 token（登录成功后由前端调用） */
  const saveToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
  }

  /** 登出并清除状态 */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* silent */ }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return { user, loading, refresh: fetchUser, logout, saveToken }
}
