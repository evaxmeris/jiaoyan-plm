'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { User, Mail, Shield, Building2, Lock, Save, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'

// 角色中文名
const ROLE_LABELS: Record<string, string> = {
  CEO: 'CEO',
  RND_MANAGER: '研发主管',
  DEVELOPER: '研发人员',
  COMPLIANCE: '合规专员',
  PURCHASER: '采购专员',
  FINANCE: '财务',
  PRODUCTION: '生产',
  OBSERVER: '观察者',
}

// 角色颜色
const ROLE_COLORS: Record<string, string> = {
  CEO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  RND_MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  DEVELOPER: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  COMPLIANCE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PURCHASER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  FINANCE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  PRODUCTION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  OBSERVER: 'bg-gray-100 text-[var(--color-text)] dark:bg-gray-800 dark:text-gray-300',
}

interface UserInfo {
  id: string
  name: string
  email: string
  role: string
  department: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { user: authUser, refresh: refreshAuth } = useAuth()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // 修改姓名
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 修改密码
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    // 未登录则跳转
    if (!authUser) return
    loadProfile()
  }, [router, authUser])

  async function loadProfile() {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('加载失败')
      }
      const data = await res.json()
      // 兼容标准响应格式 { success, data: { user } } 与旧格式顶层 user
      const profileUser = data.data?.user || data.user
      setUser(profileUser)
      setName(profileUser?.name || '')
    } catch (e) {
      console.error('加载个人信息失败', e)
    } finally {
      setLoading(false)
    }
  }

  // 修改姓名
  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameMessage({ type: 'error', text: '请输入姓名' })
      return
    }
    setSavingName(true)
    setNameMessage(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '修改失败')
      }

      // 更新本地 state
      const updatedUser = { ...user!, name: (data.data?.user || data.user)?.name }
      setUser(updatedUser)
      refreshAuth()
      setNameMessage({ type: 'success', text: '姓名修改成功' })
      setTimeout(() => setNameMessage(null), 3000)
    } catch (e: any) {
      setNameMessage({ type: 'error', text: e.message || '修改失败' })
    } finally {
      setSavingName(false)
    }
  }

  // 修改密码
  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setPasswordMessage(null)

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: '请填写所有密码字段' })
      return
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: '新密码长度不能少于6位' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: '两次输入的新密码不一致' })
      return
    }

    setSavingPassword(true)

    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '修改失败')
      }

      setPasswordMessage({ type: 'success', text: '密码修改成功' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(null), 3000)
    } catch (e: any) {
      setPasswordMessage({ type: 'error', text: e.message || '修改失败' })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-zinc-500">加载失败，请刷新页面重试</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
          <User className="w-6 h-6 text-emerald-500" />
          个人信息
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          查看和编辑您的个人资料
        </p>
      </div>

      <div className="space-y-6">
        {/* 用户信息卡片 */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            {/* 头像 */}
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {user.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">{user.name}</h2>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-zinc-100 text-zinc-700'}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-zinc-400" />
              <span className="text-[var(--color-text-secondary)]">邮箱：</span>
              <span className="text-[var(--color-text)]">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="w-4 h-4 text-zinc-400" />
              <span className="text-[var(--color-text-secondary)]">角色：</span>
              <span className="text-[var(--color-text)]">{ROLE_LABELS[user.role] || user.role}</span>
            </div>
            {user.department && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-zinc-400" />
                <span className="text-[var(--color-text-secondary)]">部门：</span>
                <span className="text-[var(--color-text)]">{user.department}</span>
              </div>
            )}
          </div>
        </div>

        {/* 修改姓名 */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500" />
            修改姓名
          </h3>

          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                placeholder="请输入姓名"
                required
              />
            </div>

            {nameMessage && (
              <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${
                nameMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800'
              }`}>
                {nameMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {nameMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingName}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {savingName ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savingName ? '保存中...' : '保存修改'}
            </button>
          </form>
        </div>

        {/* 修改密码 */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-500" />
            修改密码
          </h3>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* 旧密码 */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                旧密码
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  placeholder="请输入旧密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                新密码
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  placeholder="请输入新密码（至少6位）"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                确认新密码
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  placeholder="请再次输入新密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {passwordMessage && (
              <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${
                passwordMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800'
              }`}>
                {passwordMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {passwordMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {savingPassword ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
