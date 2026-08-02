'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Menu, FlaskConical, Home, User, LogOut, Shield, ListChecks } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import SearchDialog from '@/components/SearchDialog'
import { useAuth } from '@/lib/useAuth'

export default function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Ctrl+K 打开全局搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // 每30秒轮询待审批数量
  useEffect(() => {
    if (!user) {
      setPendingCount(0)
      return
    }

    const fetchPendingCount = async () => {
      try {
        const res = await fetch('/api/approval-requests?status=PENDING&limit=1')
        if (res.ok) {
          const data = await res.json()
          setPendingCount(data.meta?.total ?? data.data?.total ?? data.total ?? 0)
        }
      } catch {
        // 静默失败，保留上次计数
      }
    }

    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  // 登出
  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  if (pathname === '/login') return null

  const isCEO = user?.role === 'CEO'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-[var(--color-navbar)] border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:block text-[var(--color-text)]">
              交研生物 PLM
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Home className="w-3.5 h-3.5 inline mr-1" />
              首页
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 搜索按钮 */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="全局搜索"
            title="搜索 (Ctrl+K)"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 待审批角标 */}
          {user && pendingCount > 0 && (
            <Link
              href="/approvals"
              className="relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title={`${pendingCount} 个待审批请求`}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>{pendingCount > 99 ? '99+' : pendingCount}</span>
            </Link>
          )}

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-medium">
                  {user.name?.charAt(0) || '?'}
                </div>
                <span className="text-sm text-[var(--color-text)] hidden sm:block">{user.name}</span>
              </button>

              {/* 下拉菜单 */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-[var(--color-border)] py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* 用户信息头 */}
                  <div className="px-4 py-2 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium text-[var(--color-text)]">{user.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{user.email}</p>
                  </div>

                  {/* 菜单项 */}
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <User className="w-4 h-4 text-zinc-400" />
                      个人信息
                    </Link>

                    {isCEO && (
                      <Link
                        href="/settings/permissions"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Shield className="w-4 h-4 text-zinc-400" />
                        权限管理
                      </Link>
                    )}

                    {isCEO && (
                      <Link
                        href="/settings/approval-flow"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <ListChecks className="w-4 h-4 text-zinc-400" />
                        审批流程
                      </Link>
                    )}
                  </div>

                  {/* 分割线和退出 */}
                  <div className="border-t border-[var(--color-border)] pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  )
}
