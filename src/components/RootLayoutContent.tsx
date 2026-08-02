'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/Toast'

export default function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('jy_sidebar_collapsed')
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)
    if (saved !== null) setSidebarCollapsed(saved === 'true')
    else setSidebarCollapsed(window.innerWidth < 1200)
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarMobileOpen(false)
  }, [pathname])

  const toggleSidebar = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    localStorage.setItem('jy_sidebar_collapsed', String(next))
  }

  const isAuthPage = pathname === '/login' || pathname === '/register'

  if (!mounted) return <ToastProvider>{children}</ToastProvider>
  if (isAuthPage) return <ToastProvider>{children}</ToastProvider>

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--color-bg)]">
        <Navbar onMenuClick={() => setSidebarMobileOpen(true)} />
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          mobileOpen={sidebarMobileOpen}
          onMobileClose={() => setSidebarMobileOpen(false)}
        />
        <main
          className="min-h-screen pt-16 transition-all duration-300 ease-in-out"
          style={{
            paddingLeft: isMobile ? (sidebarMobileOpen ? 256 : 0) : (sidebarCollapsed ? 64 : 256),
          }}
        >
          <div className="p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
