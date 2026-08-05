'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import {
  LayoutDashboard, FlaskConical, ClipboardCheck, Package,
  Landmark, Receipt, ChevronLeft, ChevronDown,
  Beaker, FileText, Box, Syringe, FlaskRound as Flask,
  TestTube, ShieldCheck, BarChart3,
  Truck, Factory, Warehouse, ScanLine, ClipboardList,
  FileSignature, Copyright, Lightbulb,
  FileCheck, DollarSign, FileSpreadsheet, Banknote,
  Settings, GitBranch, QrCode, Users, ShoppingCart,
  HardDrive, BookOpen, MapPin,
} from 'lucide-react'

interface MenuItem {
  key: string
  label: string
  icon: React.ElementType
  href: string
}

interface MenuGroup {
  group: string
  icon: React.ElementType
  items: MenuItem[]
}

// 菜单 → 所需查看权限（对齐后端 auth.ts OPERATION_ROLES；未映射的菜单仅 CEO 可见；仪表盘无映射=所有登录用户可见）
const MENU_PERMS: Record<string, string> = {
  materials: 'material.view',
  formulas: 'formula.view',
  products: 'product.view',
  samples: 'sample.view',
  costing: 'costing.view',
  trademarks: 'trademark.view',
  patents: 'patent.view',
  'trade-secrets': 'trade_secret.view',
  purchase: 'purchase.view',
  'purchase-orders': 'purchase.view',
  suppliers: 'supplier.view',
  quality: 'ipqc.view',
  inventory: 'inventory.view',
  'product-inventory': 'inventory.view',
  supplies: 'supply.view',
  oem: 'oem.view',
  traceability: 'traceability.view',
  'compliance-overview': 'registration.view',
  registrations: 'registration.view',
  'test-entrustments': 'test_entrustment.view',
  'compliance-scan': 'registration.view',
  'efficacy-claims': 'efficacy_claim.view',
  regulations: 'registration.view',
  standards: 'registration.view',
  distribution: 'distribution_channel.view',
  'distribution-orders': 'sales_order.view',
  logistics: 'shipping.view',
  addresses: 'logistics_provider.view',
  warehouse: 'supply.view',
  'anti-counterfeit': 'anti_counterfeit.view',
  'finance-dashboard': 'budget.view',
  'service-contracts': 'service_contract.view',
  budget: 'budget.view',
  'budget-categories': 'budget.view',
  reimbursement: 'reimbursement.view',
  approvals: 'approval.view',
  permissions: 'user.view',
  'approval-flow': 'approval_flow.view',
  users: 'user.view',
  backup: 'settings.backup',
  'audit-log': 'audit_log.view',
}

const menuConfig: MenuGroup[] = [
  {
    group: '研发工作台',
    icon: FlaskConical,
    items: [
      { key: 'dashboard', label: '仪表盘', icon: BarChart3, href: '/' },
      { key: 'materials', label: '原料管理', icon: Box, href: '/rnd/materials' },
      { key: 'formulas', label: '配方管理', icon: Flask, href: '/rnd/formulas' },
      { key: 'products', label: '产品开发', icon: Syringe, href: '/rnd/products' },
      { key: 'samples', label: '样品管理', icon: Beaker, href: '/rnd/samples' },
      { key: 'costing', label: '成本核算', icon: DollarSign, href: '/rnd/costing' },
    ],
  },
  {
    group: '知识产权中心',
    icon: Landmark,
    items: [
      { key: 'trademarks', label: '商标管理', icon: FileSignature, href: '/assets/trademarks' },
      { key: 'patents', label: '专利管理', icon: Copyright, href: '/assets/patents' },
      { key: 'trade-secrets', label: '技术秘密', icon: Lightbulb, href: '/assets/trade-secrets' },
    ],
  },
  {
    group: '供应链管理',
    icon: Factory,
    items: [
      { key: 'purchase', label: '采购管理', icon: DollarSign, href: '/purchase' },
      { key: 'purchase-orders', label: '采购订单', icon: ClipboardList, href: '/purchase/orders' },
      { key: 'suppliers', label: '供应商管理', icon: Truck, href: '/supply/suppliers' },
      { key: 'quality', label: '质量管理', icon: ClipboardCheck, href: '/supply/quality' },
      { key: 'inventory', label: '原料库存', icon: Warehouse, href: '/supply/inventory' },
      { key: 'product-inventory', label: '产品库存', icon: Box, href: '/supply/product-inventory' },
      { key: 'supplies', label: '物资管理', icon: Package, href: '/supply/supplies' },
      { key: 'oem', label: '代工合作', icon: FileCheck, href: '/supply/oem' },
      { key: 'traceability', label: '溯源系统', icon: ScanLine, href: '/supply/traceability' },
    ],
  },
  {
    group: '合规中心',
    icon: ShieldCheck,
    items: [
      { key: 'compliance-overview', label: '合规总览', icon: ShieldCheck, href: '/compliance' },
      { key: 'registrations', label: '备案管理', icon: FileText, href: '/compliance/registrations' },
      { key: 'test-entrustments', label: '检测委托', icon: TestTube, href: '/compliance/test-entrustments' },
      { key: 'compliance-scan', label: '合规扫描', icon: ScanLine, href: '/compliance/scan' },
      { key: 'efficacy-claims', label: '功效宣称', icon: ShieldCheck, href: '/compliance/efficacy-claims' },
      { key: 'regulations', label: '法规数据库', icon: BookOpen, href: '/compliance/regulations' },
      { key: 'standards', label: '检测标准配置', icon: ClipboardCheck, href: '/compliance/standards' },
    ],
  },
  {
    group: '分销管理',
    icon: ShoppingCart,
    items: [
      { key: 'distribution', label: '渠道管理', icon: BarChart3, href: '/distribution' },
      { key: 'distribution-orders', label: '销售订单', icon: Receipt, href: '/distribution/orders' },
      { key: 'logistics', label: '物流发运', icon: Truck, href: '/logistics/shipping' },
      { key: 'addresses', label: '收货地址', icon: MapPin, href: '/logistics/addresses' },
      { key: 'warehouse', label: '仓区位管理', icon: Warehouse, href: '/logistics/warehouse' },
      { key: 'anti-counterfeit', label: '防伪管理', icon: QrCode, href: '/admin/anti-counterfeit' },
    ],
  },
  {
    group: '财务管理',
    icon: DollarSign,
    items: [
      { key: 'finance-dashboard', label: '预算仪表盘', icon: BarChart3, href: '/finance/dashboard' },
      { key: 'service-contracts', label: '服务合同', icon: FileSpreadsheet, href: '/service-contracts' },
      { key: 'budget', label: '预算管理', icon: Banknote, href: '/finance/budget' },
      { key: 'budget-categories', label: '预算科目', icon: Box, href: '/finance/budget-categories' },
      { key: 'reimbursement', label: '报销管理', icon: Receipt, href: '/reimbursement' },
      { key: 'approvals', label: '审批中心', icon: ClipboardCheck, href: '/approvals' },
    ],
  },
  {
    group: '系统设置',
    icon: Settings,
    items: [
      { key: 'permissions', label: '权限管理', icon: ShieldCheck, href: '/settings/permissions' },
      { key: 'approval-flow', label: '审批流配置', icon: GitBranch, href: '/settings/approval-flow' },
      { key: 'users', label: '用户管理', icon: Users, href: '/users' },
      { key: 'backup', label: '数据备份', icon: HardDrive, href: '/settings/backup' },
      { key: 'audit-log', label: '审计日志', icon: ClipboardList, href: '/settings/audit-log' },
    ],
  },
]


interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  // 按用户权限过滤菜单：CEO 全显示；其余按 MENU_PERMS 匹配后端下发的 permissions
  const visibleMenu = menuConfig
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        const perm = MENU_PERMS[i.key]
        if (!perm) return true
        if (user?.role === 'CEO') return true
        return (user as any)?.permissions?.includes(perm)
      }),
    }))
    .filter(g => g.items.length > 0)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(visibleMenu.map(g => g.group)))
  // user 异步加载完成后（权限就绪），重新展开全部可见分组
  useEffect(() => {
    if (user) {
      setExpandedGroups(new Set(visibleMenu.map(g => g.group)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  const effectiveCollapsed = mobileOpen ? false : collapsed
  const [complianceAlertCount, setComplianceAlertCount] = useState<number>(0)

  // 加载合规预警数量
  useEffect(() => {
    fetch('/api/compliance/alerts')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.counts) {
          const c = data.data.counts
          setComplianceAlertCount((c.critical || 0) + (c.warning || 0))
        }
      })
      .catch(() => {})
  }, [])

  // 关闭手机菜单
  useEffect(() => {
    if (mobileOpen) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose() }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [mobileOpen, onMobileClose])

  // Ctrl+B 切换折叠
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); onToggleCollapse() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggleCollapse])

  // 初始展开：手机只展开当前分组
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    const activeGroup = visibleMenu.find(g => g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/')))
    if (isMobile && activeGroup) {
      setExpandedGroups(new Set([activeGroup.group]))
    }
  }, [])

  // 路由变化：自动展开当前分组
  useEffect(() => {
    const activeGroup = visibleMenu.find(g => g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/')))
    if (activeGroup) {
      setExpandedGroups(prev => { const n = new Set(prev); n.add(activeGroup.group); return n })
      setTimeout(() => {
        const el = navRef.current?.querySelector('[aria-current="page"]')
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 100)
    }
  }, [pathname])

  // 所有菜单项的 href 列表，用于判断是否有子菜单项匹配
  const allHrefs = visibleMenu.flatMap(g => g.items.map(i => i.href))

  const isActive = (href: string) => {
    if (pathname === href) return true
    // 动态路由如 /supply/suppliers/123 高亮父级 /supply/suppliers
    // 但如果有同级菜单项匹配（如 /purchase/orders），父级不高亮
    if (pathname.startsWith(href + '/')) {
      const rest = pathname.slice(href.length + 1)
      const firstSegment = rest.split('/')[0]
      const hasChildMenuItem = allHrefs.some(
        item => item !== href && item.startsWith(href + '/' + firstSegment)
      )
      return !hasChildMenuItem
    }
    return false
  }

  const handleClick = (href: string) => {
    if (window.innerWidth < 768) onMobileClose()
    router.push(href)
  }

  return (
    <>
      {/* 手机遮罩 */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 h-screen pt-16 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] sidebar-transition ${
          effectiveCollapsed ? 'w-16' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        role="navigation"
        aria-label="侧边导航"
      >
        {/* 折叠按钮 */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 z-10"
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>

        <nav ref={navRef} className="flex-1 overflow-y-auto py-4 px-3 h-full">
          {visibleMenu.map(group => {
            const isExpanded = expandedGroups.has(group.group)
            const hasActive = group.items.some(i => isActive(i.href))
            const GroupIcon = group.icon

            return (
              <div key={group.group} className="mb-1">
                {/* 分组标题 */}
                {effectiveCollapsed ? (
                  <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    onClick={() => {
                      if (group.items.length > 0) handleClick(group.items[0].href)
                    }}
                  >
                    <GroupIcon className={`w-5 h-5 ${hasActive ? 'text-emerald-600' : 'text-[var(--color-text-secondary)]'}`} />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const next = new Set(expandedGroups)
                      next.has(group.group) ? next.delete(group.group) : next.add(group.group)
                      setExpandedGroups(next)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      hasActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'text-[var(--color-text-secondary)] hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <GroupIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{group.group}</span>
                    {group.group === '合规中心' && complianceAlertCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 leading-none">
                        {complianceAlertCount > 99 ? '99+' : complianceAlertCount}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>
                )}

                {/* 子菜单 */}
                {!effectiveCollapsed && isExpanded && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {group.items.map(item => {
                      const active = isActive(item.href)
                      const ItemIcon = item.icon
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleClick(item.href)}
                          aria-current={active ? 'page' : undefined}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            active
                              ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'text-[var(--color-text-secondary)] hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
