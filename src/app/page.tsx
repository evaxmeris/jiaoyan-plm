'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import {
  FlaskConical, ClipboardCheck, AlertTriangle, DollarSign,
  Clock, Plus, Beaker, FileText, TestTube, Truck,
  Users, Percent, ArrowRight, ChevronRight, AlertOctagon, Bell,
  BarChart3, TrendingUp, Shield, Calendar, CheckCircle2, Activity,
} from 'lucide-react'

/* ───────── 类型定义 ───────── */

interface AlertItem {
  id: string
  type: string
  entityType: string
  entityId: string
  title: string
  dueDate: string
  urgency: 'high' | 'medium'
  daysLeft: number
  amount?: number
}

interface DashboardData {
  stats: {
    rndProducts: number       // 研发中产品
    pendingApprovals: number  // 待审批事项
    expiringItems: number     // 到期预警
    monthlySales: number      // 本月销售
  }
}

interface PendingItem {
  id: string
  title: string
  entityType: string
  entityName: string
  entityId?: string
  dueDate?: string
  urgency: 'high' | 'medium' | 'low'
}

interface ActivityItem {
  id: string
  user: string
  action: string
  target: string
  createdAt: string
}

interface ApprovalRequest {
  id: string
  title: string
  entityType: string
  status: string
  requester: { name: string }
  createdAt: string
}

interface Trademark {
  id: string
  name: string
  category: string
  expireDate: string | null
  status: string
}

/* ───────── 常量 ───────── */

const STATUS_LABELS: Record<string, string> = {
  CONCEPT: '概念',
  DESIGNING: '设计中',
  SAMPLING: '打样',
  TESTING: '检测中',
  REGISTERING: '备案中',
  READY: '可量产',
  LAUNCHED: '已上市',
  DISCONTINUED: '已停产',
}

const STATUS_COLORS: Record<string, string> = {
  CONCEPT: 'var(--color-chart-1, #94a3b8)',
  DESIGNING: 'var(--color-chart-2, #60a5fa)',
  SAMPLING: 'var(--color-chart-3, #fbbf24)',
  TESTING: 'var(--color-chart-4, #fb923c)',
  REGISTERING: 'var(--color-chart-5, #a78bfa)',
  READY: 'var(--color-chart-6, #34d399)',
  LAUNCHED: 'var(--color-chart-7, #10b981)',
  DISCONTINUED: 'var(--color-chart-8, #f87171)',
}

const STATUS_BG_CLASSES: Record<string, string> = {
  CONCEPT: 'bg-slate-400',
  DESIGNING: 'bg-blue-400',
  SAMPLING: 'bg-amber-400',
  TESTING: 'bg-orange-400',
  REGISTERING: 'bg-purple-400',
  READY: 'bg-emerald-400',
  LAUNCHED: 'bg-green-500',
  DISCONTINUED: 'bg-red-400',
}

const STATUS_ORDER = ['CONCEPT', 'DESIGNING', 'SAMPLING', 'TESTING', 'REGISTERING', 'READY', 'LAUNCHED', 'DISCONTINUED']

/* ───────── 主组件 ───────── */

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [registrations, setRegistrations] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      // 统计卡片
      fetch('/api/dashboard').then(r => r.ok ? r.json() : Promise.reject('Dashboard API error')).catch(() => {
        console.warn('获取仪表盘数据失败')
        return {}
      }),
      // 近期动态
      fetch('/api/audit-log?limit=50').then(r => r.json()).catch(() => ({ logs: [] })),
      // 待审批请求
      fetch('/api/approval-requests?status=PENDING&limit=10').then(r => r.json()).catch(() => ({ data: [] })),
      // 商标到期
      fetch('/api/assets/trademarks').then(r => r.json()).catch(() => ({ trademarks: [] })),
      // 产品列表（用于阶段分布）
      fetch('/api/rnd/products').then(r => r.json()).catch(() => ({ products: [] })),
      // 备案列表（用于合规状态）
      fetch('/api/compliance/registrations').then(r => r.json()).catch(() => ({ registrations: [] })),
    ]).then(([dashboardData, auditRes, approvalRes, trademarkRes, productRes, regRes]) => {
      // ── 统计卡片 ──
      const stats = dashboardData.stats || {}
      setDash({
        stats: {
          rndProducts: stats.rndProducts ?? 0,
          pendingApprovals: stats.pendingApprovals ?? 0,
          expiringItems: stats.expiringItems ?? 0,
          monthlySales: stats.monthlySales ?? 0,
        },
      })

      // ── 近期动态 ──
      const logs: ActivityItem[] = (auditRes.logs || []).map((l: any) => ({
        id: l.id,
        user: l.userName || '-',
        action: formatAction(l.action, l.entity),
        target: l.detail?.name || (l.entity === 'User' ? (l.detail?.email || '-') : '-'),
        createdAt: l.createdAt,
      }))
      setActivities(logs)

      // ── 待办事项（合并多个来源，按紧急程度排序） ──
      const pending: PendingItem[] = []

      // ① 待审批请求 → 黄色 urgent
      const approvals: ApprovalRequest[] = approvalRes.data || []
      approvals.forEach((a: ApprovalRequest) => {
        pending.push({
          id: `apr-${a.id}`,
          title: a.title,
          entityType: 'approval',
          entityName: a.entityType,
          dueDate: undefined,
          urgency: 'medium',
        })
      })

      // ② 到期商标 → 红色 urgent
      const today = new Date()
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      const trademarks: Trademark[] = trademarkRes.trademarks || []
      trademarks.forEach((t: Trademark) => {
        if (t.expireDate) {
          const ex = new Date(t.expireDate)
          if (ex >= today && ex <= thirtyDaysFromNow) {
            pending.push({
              id: `tm-${t.id}`,
              title: `备案即将到期 · ${t.name}`,
              entityType: 'trademark',
              entityName: t.name,
              entityId: t.id,
              dueDate: t.expireDate,
              urgency: ex.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000 ? 'high' : 'medium',
            })
          }
        }
      })

      // ③ 到期专利 → 红色 urgent（来自仪表盘数据）
      const expiringPatents: { id: string; name: string; expireDate: string }[] = dashboardData.expiringPatentsList || []
      expiringPatents.forEach((p) => {
        const ex = new Date(p.expireDate)
        if (ex >= today) {
          pending.push({
            id: `pt-${p.id}`,
            title: `专利即将到期 · ${p.name}`,
            entityType: 'patent',
            entityName: p.name,
            entityId: p.id,
            dueDate: p.expireDate,
            urgency: ex.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000 ? 'high' : 'medium',
          })
        }
      })

      // ④ 待审批用户 (如果 dashboardData 有提供)
      if (stats.pendingUsers && stats.pendingUsers > 0) {
        pending.push({
          id: 'pending-users',
          title: `新注册用户待审批（${stats.pendingUsers}人）`,
          entityType: 'user',
          entityName: '',
          dueDate: undefined,
          urgency: 'low',
        })
      }

      // 按紧急程度排序：high → medium → low
      pending.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.urgency] - order[b.urgency]
      })
      setPendingItems(pending)

      // ── 产品列表 ──
      setProducts(productRes.products || [])

      // ── 备案列表 ──
      setRegistrations(regRes.registrations || [])

      setLoading(false)
    }).catch(() => setLoading(false))

    // ── 统一预警数据（到期预警区块） ──
    fetch('/api/alerts').then(r => r.json()).then(data => {
      if (data.alerts) setAlerts(data.alerts)
    }).catch(() => console.warn('获取预警数据失败'))
  }, [])

  /* ───────── 计算统计数据 ───────── */

  // 产品阶段分布
  const statusDistribution = useCallback(() => {
    const counts: Record<string, number> = {}
    products.forEach((p: any) => {
      const s = p.status || 'CONCEPT'
      counts[s] = (counts[s] || 0) + 1
    })
    const maxCount = Math.max(...Object.values(counts), 1)
    return STATUS_ORDER.map(s => ({
      status: s,
      label: STATUS_LABELS[s] || s,
      count: counts[s] || 0,
      pct: counts[s] ? Math.round((counts[s] / (products.length || 1)) * 100) : 0,
      barPct: counts[s] ? Math.max(3, (counts[s] / maxCount) * 100) : 0,
      color: STATUS_BG_CLASSES[s],
    }))
  }, [products])()

  // 月度趋势（从动态数据推断近12个月）
  const monthlyTrend = useCallback(() => {
    const months: { key: string; label: string; count: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
      const count = activities.filter(a => {
        const ad = new Date(a.createdAt)
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth()
      }).length
      months.push({ key, label, count })
    }
    const maxCount = Math.max(...months.map(m => m.count), 1)
    return { months, maxCount }
  }, [activities])()

  // 合规状态
  const complianceStats = useCallback(() => {
    const total = registrations.length
    const applying = registrations.filter((r: any) => r.status === 'APPLYING').length
    const registered = registrations.filter((r: any) => r.status === 'REGISTERED').length
    const supplement = registrations.filter((r: any) => r.status === 'SUPPLEMENT').length
    // 计算检测完成率（从备案关联的 testEntrustments 判断）
    let inspectionsTotal = 0
    let inspectionsCompleted = 0
    registrations.forEach((r: any) => {
      const ents = r.testEntrustments || r.inspections
      if (ents && Array.isArray(ents)) {
        inspectionsTotal += ents.length
        inspectionsCompleted += ents.filter((i: any) => i.status === 'PASS' || i.status === 'COMPLETED').length
      }
    })
    return { total, applying, registered, supplement, inspectionsTotal, inspectionsCompleted }
  }, [registrations])()

  /* ───────── 加载态 ───────── */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-60 skeleton rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-56 skeleton rounded-xl" />
          <div className="h-56 skeleton rounded-xl" />
        </div>
        <div className="h-48 skeleton rounded-xl" />
        <div className="h-32 skeleton rounded-xl" />
        <div className="h-36 skeleton rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      {/* ══════ 顶部：欢迎区 ══════ */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {user ? `你好，${user.name}` : '欢迎回来'}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">交研生物产品研发管理系统</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-4 py-2 shadow-sm">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
          })}
        </div>
      </div>

      {/* ══════ KPI 统计卡片 ══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={FlaskConical}
          label="研发中产品"
          value={`${dash?.stats.rndProducts ?? 0}个`}
          trend={dash?.stats.rndProducts ?? 0 > 0 ? '+12%' : undefined}
          color="emerald"
          onClick={() => router.push('/rnd/products')}
        />
        <KpiCard
          icon={ClipboardCheck}
          label="待审批事项"
          value={`${dash?.stats.pendingApprovals ?? 0}项`}
          trend={dash?.stats.pendingApprovals ?? 0 > 0 ? undefined : undefined}
          color="blue"
          onClick={() => router.push('/purchase')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="到期预警"
          value={`${dash?.stats.expiringItems ?? 0}项`}
          trend={dash?.stats.expiringItems ?? 0 > 0 ? '需关注' : undefined}
          color="amber"
          onClick={() => router.push('/assets/trademarks')}
        />
        <KpiCard
          icon={DollarSign}
          label="本月销售"
          value={`¥${(dash?.stats.monthlySales ?? 0).toLocaleString('zh-CN')}`}
          trend={dash?.stats.monthlySales ?? 0 > 0 ? '+8%' : undefined}
          color="rose"
          onClick={() => router.push('/distribution')}
        />
      </div>

      {/* ══════ 图表区：产品阶段分布 + 月度趋势 ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左 2/3：产品阶段分布柱状图 */}
        <div className="lg:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
            产品阶段分布
            {products.length > 0 && (
              <span className="ml-auto text-xs font-normal text-[var(--color-text-secondary)]">
                共 {products.length} 个产品
              </span>
            )}
          </h2>
          {products.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--color-text-secondary)]">
              暂无产品数据
            </div>
          ) : (
            <div className="space-y-3">
              {statusDistribution.map(item => (
                <BarRow key={item.status} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* 右 1/3：月度趋势概览 */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
            月度趋势概览
          </h2>
          <div className="flex items-end justify-between gap-1 h-40">
            {monthlyTrend.months.map(m => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">{m.count}</span>
                <div
                  className="w-full rounded-t-sm transition-all duration-500 hover:opacity-80 cursor-pointer"
                  style={{
                    height: `${Math.max(4, (m.count / monthlyTrend.maxCount) * 120)}px`,
                    background: 'linear-gradient(to top, var(--color-primary), var(--color-primary-hover, var(--color-primary)))',
                    opacity: 0.7 + (m.count / monthlyTrend.maxCount) * 0.3,
                  }}
                  title={`${m.label}: ${m.count} 条记录`}
                />
                <span className="text-[9px] text-[var(--color-text-secondary)] truncate w-full text-center" style={{ writingMode: 'horizontal-tb' }}>
                  {m.label.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] text-center mt-3">近12个月操作记录趋势</p>
        </div>
      </div>

      {/* ══════ 待办事项 ══════ */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[var(--color-primary)]" />
          待办事项
          {pendingItems.length > 0 && (
            <span className="ml-auto text-xs font-normal text-[var(--color-text-secondary)]">
              共 {pendingItems.length} 项
            </span>
          )}
        </h2>

        {pendingItems.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 py-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            所有事项已处理，暂无待办
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {pendingItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3 group cursor-pointer hover:bg-[var(--color-bg)] -mx-5 px-5 transition-colors"
                onClick={() => {
                  if (item.entityType === 'trademark' && item.entityId) router.push(`/assets/trademarks/${item.entityId}`)
                  else if (item.entityType === 'trademark') router.push('/assets/trademarks')
                  else if (item.entityType === 'patent' && item.entityId) router.push(`/assets/patents/${item.entityId}`)
                  else if (item.entityType === 'patent') router.push('/assets/patents')
                  else if (item.entityType === 'approval') router.push('/purchase')
                  else if (item.entityType === 'user') router.push('/users')
                }}
              >
                {/* 紧急程度指示器 */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  item.urgency === 'high' ? 'bg-red-500' :
                  item.urgency === 'medium' ? 'bg-amber-400' :
                  'bg-emerald-500'
                }`} />

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {item.title}
                  </p>
                  {item.dueDate && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      截止 {new Date(item.dueDate).toLocaleDateString('zh-CN')}
                    </p>
                  )}
                </div>

                {/* 标签 */}
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  item.urgency === 'high' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                  item.urgency === 'medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                  'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                }`}>
                  {item.urgency === 'high' ? '紧急' :
                   item.urgency === 'medium' ? '待处理' : '待办'}
                </span>

                <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════ 合规状态卡片 ══════ */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--color-primary)]" />
          合规状态概览
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 备案总数 */}
          <ComplianceCard
            label="备案总数"
            value={complianceStats.total}
            icon={FileText}
            color="blue"
            detail={complianceStats.total > 0 ? `${complianceStats.registered} 个已注册` : undefined}
          />
          {/* 备案中 */}
          <ComplianceCard
            label="备案中"
            value={complianceStats.applying}
            icon={Activity}
            color="amber"
            progress={complianceStats.total > 0 ? complianceStats.applying / complianceStats.total : 0}
            detail={complianceStats.supplement > 0 ? `${complianceStats.supplement} 个需补正` : undefined}
          />
          {/* 检测完成率 */}
          <ComplianceCard
            label="检测完成率"
            value={complianceStats.inspectionsTotal > 0
              ? `${Math.round((complianceStats.inspectionsCompleted / complianceStats.inspectionsTotal) * 100)}%`
              : '-'}
            icon={CheckCircle2}
            color="emerald"
            progress={complianceStats.inspectionsTotal > 0
              ? complianceStats.inspectionsCompleted / complianceStats.inspectionsTotal
              : 0}
            detail={`${complianceStats.inspectionsCompleted}/${complianceStats.inspectionsTotal} 项完成`}
          />
          {/* 已注册产品 */}
          <ComplianceCard
            label="已注册"
            value={complianceStats.registered}
            icon={Shield}
            color="green"
            detail="已完成备案流程"
          />
        </div>
      </div>

      {/* ══════ 到期预警时间线 ══════ */}
      {alerts.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
            到期预警时间线
            <span className="ml-auto text-xs font-normal text-[var(--color-text-secondary)]">
              共 {alerts.length} 项
            </span>
          </h2>

          <div className="relative">
            {/* 时间线竖线 */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[var(--color-border)]" />

            <div className="space-y-0">
              {alerts.slice(0, 8).map((alert, idx) => (
                <TimelineItem key={alert.id} alert={alert} isLast={idx === Math.min(alerts.length, 8) - 1} />
              ))}
            </div>
          </div>

          {alerts.length > 8 && (
            <div className="text-center mt-3">
              <span className="text-xs text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                还有 {alerts.length - 8} 项预警...
              </span>
            </div>
          )}
        </div>
      )}

      {/* ══════ 快捷操作 + 近期动态 ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左：快捷操作 (2/3) */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm h-full">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--color-primary)]" />
              快捷操作
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickActionBtn
                icon={Beaker} label="新建原料" color="emerald"
                onClick={() => router.push('/rnd/materials')}
              />
              <QuickActionBtn
                icon={FlaskConical} label="新建配方" color="blue"
                onClick={() => router.push('/rnd/formulas')}
              />
              <QuickActionBtn
                icon={TestTube} label="新建检测" color="purple"
                onClick={() => router.push('/compliance/test-entrustments')}
              />
              <QuickActionBtn
                icon={DollarSign} label="新建采购" color="rose"
                onClick={() => router.push('/purchase')}
              />
              <QuickActionBtn
                icon={FileText} label="新建商标" color="amber"
                onClick={() => router.push('/assets/trademarks')}
              />
              <QuickActionBtn
                icon={Truck} label="新建供应商" color="cyan"
                onClick={() => router.push('/supply/suppliers')}
              />
              <QuickActionBtn
                icon={Users} label="产品管理" color="indigo"
                onClick={() => router.push('/rnd/products')}
              />
              <QuickActionBtn
                icon={Percent} label="备案管理" color="slate"
                onClick={() => router.push('/compliance/registrations')}
              />
            </div>
          </div>
        </div>

        {/* 右：近期动态 (1/3) */}
        <div>
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm h-full">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />
              近期动态
            </h2>
            {activities.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">暂无操作记录</p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 6).map((a, i) => (
                  <div key={a.id || i} className="flex items-start gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0 leading-relaxed">
                      <span className="text-[var(--color-text)]">{a.user}</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {' '}{a.action}{a.target ? ` ${a.target}` : ''}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0 whitespace-nowrap">
                      {formatTimeAgo(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── 子组件 ───────── */

function KpiCard({
  icon: Icon, label, value, trend, color, onClick,
}: {
  icon: React.ElementType; label: string; value: string; trend?: string; color: string; onClick?: () => void
}) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    purple: 'from-purple-500 to-purple-600',
    cyan: 'from-cyan-500 to-cyan-600',
    indigo: 'from-indigo-500 to-indigo-600',
    slate: 'from-slate-500 to-slate-600',
    green: 'from-green-500 to-green-600',
  }

  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20',
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20',
    rose: 'bg-rose-50 dark:bg-rose-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20',
    slate: 'bg-slate-50 dark:bg-slate-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
  }

  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    purple: 'text-purple-600 dark:text-purple-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    slate: 'text-slate-600 dark:text-slate-400',
    green: 'text-green-600 dark:text-green-400',
  }

  return (
    <div
      onClick={onClick}
      className="relative bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden"
    >
      {/* 顶部渐变装饰条 */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorMap[color] || 'from-emerald-500 to-emerald-600'}`} />

      <div className="flex items-start justify-between mt-1">
        <div className={`p-2.5 rounded-lg ${bgMap[color]}`}>
          <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
            trend === '需关注' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
            'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
          }`}>
            {trend}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-bold text-[var(--color-text)] tracking-tight">{value}</p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{label}</p>
      </div>

      {/* 悬停指示箭头 */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className={`w-4 h-4 ${iconColorMap[color]}`} />
      </div>
    </div>
  )
}

/* ───────── 柱状图行 ───────── */

function BarRow({ item }: { item: { status: string; label: string; count: number; pct: number; barPct: number; color: string } }) {
  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs text-[var(--color-text-secondary)] w-16 flex-shrink-0">{item.label}</span>
      <div className="flex-1 bg-[var(--color-bg)] rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full ${item.color} transition-all duration-700 group-hover:opacity-80`}
          style={{ width: `${item.barPct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-[var(--color-text)] w-8 text-right flex-shrink-0">{item.count}</span>
      <span className="text-[11px] text-[var(--color-text-secondary)] w-10 text-right flex-shrink-0">{item.pct}%</span>
    </div>
  )
}

/* ───────── 合规卡片 ───────── */

function ComplianceCard({
  label, value, icon: Icon, color, detail, progress,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string; detail?: string; progress?: number
}) {
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800',
  }
  const progressColor: Record<string, string> = {
    blue: 'bg-blue-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', green: 'bg-green-500', red: 'bg-red-500',
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-all hover:shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${colorStyles[color] || colorStyles.blue} flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)] tracking-tight">{value}</div>

      {progress !== undefined && (
        <div className="mt-2 bg-[var(--color-border)] rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor[color] || 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      )}

      {detail && (
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">{detail}</p>
      )}
    </div>
  )
}

/* ───────── 时间线项 ───────── */

function TimelineItem({ alert, isLast }: { alert: AlertItem; isLast: boolean }) {
  const isHigh = alert.urgency === 'high'

  return (
    <div className="relative flex gap-4 py-3">
      {/* 时间线圆点 */}
      <div className="relative z-10 flex-shrink-0 mt-0.5">
        <div className={`w-2.5 h-2.5 rounded-full border-2 ${
          isHigh
            ? 'bg-red-500 border-red-200 dark:border-red-900'
            : 'bg-amber-400 border-amber-200 dark:border-amber-900'
        }`} />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-sm font-medium ${isHigh ? 'text-red-600 dark:text-red-400' : 'text-[var(--color-text)]'}`}>
              {alert.title}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {new Date(alert.dueDate).toLocaleDateString('zh-CN')}
              {alert.amount ? ` · ¥${alert.amount}` : ''}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
            isHigh
              ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
          }`}>
            {alert.daysLeft} 天
          </span>
        </div>
        {/* 进度条 - 表示剩余时间紧迫度 */}
        <div className="mt-1.5 bg-[var(--color-border)] rounded-full h-1 overflow-hidden max-w-40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHigh ? 'bg-red-400' : 'bg-amber-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, ((60 - alert.daysLeft) / 60) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function QuickActionBtn({
  icon: Icon, label, color, onClick,
}: {
  icon: React.ElementType; label: string; color: string; onClick: () => void
}) {
  const colorStyles: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/30',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/30',
    purple: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-900/30',
    rose: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/30',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/30',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800 dark:hover:bg-cyan-900/30',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/30',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-900/30',
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl border text-sm font-medium transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 ${colorStyles[color] || colorStyles.emerald}`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  )
}

/* ───────── 工具函数 ───────── */

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function formatAction(action: string, entity: string): string {
  const actionMap: Record<string, string> = {
    CREATE: '创建了',
    UPDATE: '更新了',
    DELETE: '删除了',
    APPROVE: '审批了',
    REJECT: '驳回了',
    SUBMIT: '提交了',
    UPLOAD: '上传了',
    LOGIN: '登录了',
  }
  const entityMap: Record<string, string> = {
    Formula: '配方',
    ProductDesign: '产品',
    RawMaterial: '原料',
    Inspection: '检测',
    Trademark: '商标',
    Patent: '专利',
    PurchaseApplication: '采购申请',
    Supplier: '供应商',
    Registration: '备案',
    User: '用户',
  }
  const a = actionMap[action] || action
  const e = entityMap[entity] || entity
  return `${a}${e}`
}
