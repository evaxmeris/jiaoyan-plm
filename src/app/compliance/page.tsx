'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, FileText, TestTube, ClipboardCheck,
  CheckCircle2, Circle, Clock, AlertCircle, ChevronRight,
  FlaskConical, FileSearch, Send, BookOpen, Eye, Globe,
  AlertTriangle, Ban, FileWarning, BookOpenCheck,
  ScanSearch, Percent, Bell,
} from 'lucide-react'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

// 合规流程阶段定义
interface ComplianceStage {
  stage: string
  label: string
  description: string
  icon: React.ElementType
  href: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  count?: number
}

const STAGES: ComplianceStage[] = [
  {
    stage: 'INGREDIENT_CHECK',
    label: '原料筛查',
    description: '原料禁用组分/限用物质合规筛查',
    icon: FileSearch,
    href: '/rnd/materials',
    status: 'PENDING',
  },
  {
    stage: 'TEST_ENTRUST',
    label: '送检',
    description: '产品送检（微生物/理化/功效/防腐挑战）',
    icon: TestTube,
    href: '/compliance/test-entrustments',
    status: 'PENDING',
  },
  {
    stage: 'SAFETY_ASSESS',
    label: '安全评估',
    description: '产品安全评估报告编制与审核',
    icon: ClipboardCheck,
    href: '/compliance/test-entrustments',
    status: 'PENDING',
  },
  {
    stage: 'SUBMIT',
    label: '备案提交',
    description: '备案资料编制与网上提交',
    icon: Send,
    href: '/compliance/registrations',
    status: 'PENDING',
  },
  {
    stage: 'ACCEPTED',
    label: '受理',
    description: '药监局受理、形式审查',
    icon: BookOpen,
    href: '/compliance/registrations',
    status: 'PENDING',
  },
  {
    stage: 'PUBLICITY',
    label: '公示',
    description: '备案信息公示期',
    icon: Globe,
    href: '/compliance/registrations',
    status: 'PENDING',
  },
  {
    stage: 'COMPLETED',
    label: '完成',
    description: '备案完成，获准备案编号',
    icon: CheckCircle2,
    href: '/compliance/registrations',
    status: 'PENDING',
  },
]

const STAGE_STATUS_MAP: Record<string, string[]> = {
  INGREDIENT_CHECK: ['UNRECORDED', 'RECORDING'],
  TEST_ENTRUST: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
  SAFETY_ASSESS: ['PENDING'],
  SUBMIT: ['APPLYING'],
  ACCEPTED: ['SUPPLEMENT'],
  PUBLICITY: ['CHANGE'],
  COMPLETED: ['REGISTERED'],
}

interface StatsData {
  regulations: {
    total: number
    byMarket: Record<string, number>
  }
  formulaScan: {
    total: number
    scanned: number
    pending: number
    rate: number
  }
  registration: {
    totalProducts: number
    registered: number
    needRegistration: number
    pending: number
    rate: number
  }
  alerts: {
    total30Days: number
    expiringRegistrations: number
    expiredTestReports: number
    criticalOverdueDocs: number
  }
  coverage: {
    rate: number
    label: string
  }
}

/** SVG 环形图组件 */
function RingChart({ rate, size = 120, strokeWidth = 10 }: { rate: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference
  const center = size / 2

  const color = rate >= 80 ? '#059669' : rate >= 50 ? '#d97706' : '#dc2626'

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* 背景圆环 */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      {/* 进度圆环 */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      {/* 中心文字 */}
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-[var(--color-text)]"
        transform={`rotate(90, ${center}, ${center})`}
        fontSize={size * 0.18}
        fontWeight={700}
      >
        {rate}%
      </text>
      <text
        x={center}
        y={center + size * 0.14}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-[var(--color-text-secondary)]"
        transform={`rotate(90, ${center}, ${center})`}
        fontSize={size * 0.09}
      >
        覆盖率
      </text>
    </svg>
  )
}

export default function CompliancePage() {
  const router = useRouter()
  const [registrations, setRegistrations] = useState<any[]>([])
  const [testEntrustments, setTestEntrustments] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [alertExpanded, setAlertExpanded] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    expired: 0,
  })
  const [complianceStats, setComplianceStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, iRes, aRes, sRes] = await Promise.all([
        apiFetch('/api/compliance/registrations'),
        apiFetch('/api/compliance/test-entrustments'),
        apiFetch('/api/compliance/alerts'),
        apiFetch('/api/compliance/stats'),
      ])
      const rData = await rRes.json()
      const iData = await iRes.json()
      const aData = await aRes.json()
      const sData = await sRes.json()
      const regs = rData.registrations || []
      const insps = iData.testEntrustments || []
      setRegistrations(regs)
      setTestEntrustments(insps)
      if (aData.success && aData.data) {
        setAlerts(aData.data)
      }
      if (sData.success && sData.data) {
        setComplianceStats(sData.data)
      }

      // 计算统计数据
      const total = regs.length
      const completed = regs.filter((r: any) => r.status === 'REGISTERED').length
      const expired = regs.filter((r: any) => r.status === 'CANCELLED').length
      const pending = regs.filter((r: any) => r.status === 'APPLYING' || r.status === 'SUPPLEMENT').length
      setStats({ total, pending, inProgress: total - completed - pending - expired, completed, expired })
    } catch (e) {
      console.error('加载合规数据失败', e)
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData().catch(() => {}) }, [fetchData])

  // 计算各阶段状态
  const getStageStatus = (stage: ComplianceStage): 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' => {
    const statusMap = STAGE_STATUS_MAP[stage.stage]
    if (!statusMap) return 'PENDING'

    // 送检阶段：检查 testEntrustments
    if (stage.stage === 'TEST_ENTRUST') {
      if (testEntrustments.length === 0) return 'PENDING'
      const allCompleted = testEntrustments.every((i: any) => i.status === 'COMPLETED')
      const anyInProgress = testEntrustments.some((i: any) => i.status === 'IN_PROGRESS')
      if (allCompleted) return 'COMPLETED'
      if (anyInProgress) return 'IN_PROGRESS'
      return 'PENDING'
    }

    // 备案阶段：检查 registrations
    if (registrations.length === 0) return 'PENDING'
    if (stage.stage === 'SUBMIT') {
      const applying = registrations.filter((r: any) => r.status === 'APPLYING')
      return applying.length > 0 ? 'IN_PROGRESS' : 'PENDING'
    }
    if (stage.stage === 'ACCEPTED') {
      const supplement = registrations.filter((r: any) => r.status === 'SUPPLEMENT')
      return supplement.length > 0 ? 'IN_PROGRESS' : 'PENDING'
    }
    if (stage.stage === 'PUBLICITY') {
      const change = registrations.filter((r: any) => r.status === 'CHANGE')
      return change.length > 0 ? 'IN_PROGRESS' : 'PENDING'
    }
    if (stage.stage === 'COMPLETED') {
      const completed = registrations.filter((r: any) => r.status === 'REGISTERED')
      return completed.length > 0 ? 'COMPLETED' : 'PENDING'
    }

    return 'PENDING'
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-6 h-6 text-green-500" />
      case 'IN_PROGRESS': return <Clock className="w-6 h-6 text-blue-500" />
      case 'FAILED': return <AlertCircle className="w-6 h-6 text-red-500" />
      default: return <Circle className="w-6 h-6 text-gray-300" />
    }
  }

  const statusBarColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500'
      case 'IN_PROGRESS': return 'bg-blue-500'
      default: return 'bg-gray-200'
    }
  }

  // 计算整体进度
  const completedCount = STAGES.filter(s => getStageStatus(s) === 'COMPLETED').length
  const progressPercent = Math.round((completedCount / STAGES.length) * 100)

  // 市场中文映射
  const marketLabel: Record<string, string> = {
    CHINA: '中国', EU: '欧盟', US: '美国', KSA: '沙特',
    JP: '日本', KR: '韩国', MY: '马来西亚', PH: '菲律宾',
    RU: '俄罗斯', GB: '英国',
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">合规中心</h1>
          </div>
          <button
            onClick={() => router.push('/compliance/registrations')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            + 新建备案
          </button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 space-y-6 fade-in">
        {/* ========== 全局统计仪表盘 ========== */}
        {complianceStats && (
          <>
            {/* 4个大指标卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 法规库 */}
              <div className="bg-[var(--color-card)] rounded-xl border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <BookOpenCheck className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">法规库</div>
                  <div className="text-2xl font-bold text-[var(--color-text)]">{complianceStats.regulations.total}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 truncate">
                    {Object.entries(complianceStats.regulations.byMarket).map(([m, c]) => (
                      <span key={m} className="mr-2">{marketLabel[m] || m}: {c}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 配方扫描 */}
              <div className="bg-[var(--color-card)] rounded-xl border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ScanSearch className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">配方扫描</div>
                  <div className="text-2xl font-bold text-[var(--color-text)]">
                    {complianceStats.formulaScan.scanned}
                    <span className="text-base font-normal text-[var(--color-text-secondary)]"> / {complianceStats.formulaScan.total}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-24">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${complianceStats.formulaScan.rate}%`,
                          backgroundColor: complianceStats.formulaScan.rate >= 80 ? '#059669' : complianceStats.formulaScan.rate >= 50 ? '#d97706' : '#dc2626',
                        }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">{complianceStats.formulaScan.rate}%</span>
                  </div>
                </div>
              </div>

              {/* 备案进度 */}
              <div className="bg-[var(--color-card)] rounded-xl border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">备案进度</div>
                  <div className="text-2xl font-bold text-[var(--color-text)]">
                    {complianceStats.registration.registered}
                    <span className="text-base font-normal text-[var(--color-text-secondary)]"> / {complianceStats.registration.needRegistration}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-24">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${complianceStats.registration.rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">{complianceStats.registration.rate}%</span>
                  </div>
                </div>
              </div>

              {/* 到期预警 */}
              <div className="bg-[var(--color-card)] rounded-xl border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  complianceStats.alerts.total30Days > 0 ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  <Bell className={`w-5 h-5 ${
                    complianceStats.alerts.total30Days > 0 ? 'text-red-600' : 'text-green-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">30天内到期预警</div>
                  <div className={`text-2xl font-bold ${
                    complianceStats.alerts.total30Days > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {complianceStats.alerts.total30Days}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    {complianceStats.alerts.total30Days > 0 ? (
                      <>
                        {complianceStats.alerts.expiringRegistrations > 0 && `备案到期 ${complianceStats.alerts.expiringRegistrations} `}
                        {complianceStats.alerts.expiredTestReports > 0 && `报告过期 ${complianceStats.alerts.expiredTestReports} `}
                        {complianceStats.alerts.criticalOverdueDocs > 0 && `材料超期 ${complianceStats.alerts.criticalOverdueDocs} `}
                      </>
                    ) : '暂无预警'}
                  </div>
                </div>
              </div>
            </div>

            {/* 合规覆盖率环形图 + 备案统计小卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 合规覆盖率 */}
              <div className="bg-[var(--color-card)] rounded-xl border p-5 flex flex-col items-center justify-center">
                <div className="text-sm font-medium text-[var(--color-text)] mb-3">合规覆盖率</div>
                <RingChart rate={complianceStats.coverage.rate} />
                <div className={`mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                  complianceStats.coverage.rate >= 80 ? 'bg-green-100 text-green-700' :
                  complianceStats.coverage.rate >= 50 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {complianceStats.coverage.label}
                </div>
                <div className="mt-2 text-xs text-[var(--color-text-secondary)] text-center">
                  已扫描配方 {complianceStats.formulaScan.scanned} / {complianceStats.formulaScan.total}
                </div>
              </div>

              {/* 备案进度详情 */}
              <div className="md:col-span-2 bg-[var(--color-card)] rounded-xl border p-5">
                <div className="text-sm font-medium text-[var(--color-text)] mb-4">备案进度详情</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{complianceStats.registration.needRegistration}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">需备案产品</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{complianceStats.registration.pending}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">待完成备案</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">{complianceStats.registration.registered}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">已备案完成</div>
                  </div>
                </div>
                {/* 微进度条 */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                    <span>备案完成率</span>
                    <span>{complianceStats.registration.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 via-emerald-400 to-green-500 rounded-full transition-all duration-700"
                      style={{ width: `${complianceStats.registration.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 合规预警面板 */}

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">备案总数</div>
            <div className="text-2xl font-bold">{loading ? '...' : stats.total}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">待办</div>
            <div className="text-2xl font-bold text-yellow-600">{loading ? '...' : stats.pending}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">进行中</div>
            <div className="text-2xl font-bold text-blue-600">{loading ? '...' : stats.inProgress}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">已完成</div>
            <div className="text-2xl font-bold text-green-600">{loading ? '...' : stats.completed}</div>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border p-4">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">已注销</div>
            <div className="text-2xl font-bold text-gray-400">{loading ? '...' : stats.expired}</div>
          </div>
        </div>

        {/* 合规预警面板 */}
        {alerts && (
          <div className={`bg-[var(--color-card)] rounded-xl border ${alerts.counts?.critical > 0 ? 'border-red-200' : alerts.counts?.warning > 0 ? 'border-amber-200' : 'border-green-200'}`}>
            <button
              onClick={() => setAlertExpanded(!alertExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg)] transition-colors"
            >
              <div className="flex items-center gap-2">
                {alerts.counts?.critical > 0 ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : alerts.counts?.warning > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                <h3 className="font-medium text-[var(--color-text)] text-sm">合规预警</h3>
                <div className="flex gap-1.5 ml-2">
                  {alerts.counts?.critical > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      紧急 {alerts.counts.critical}
                    </span>
                  )}
                  {alerts.counts?.warning > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      预警 {alerts.counts.warning}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-[var(--color-text-secondary)] transition-transform ${alertExpanded ? 'rotate-90' : ''}`} />
            </button>

            {alertExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t pt-3">
                {/* 备案到期 */}
                <div>
                  {alerts.alerts?.expiringRegistrations > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Ban className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs font-medium text-red-700">备案即将到期（30天内）</span>
                        <span className="text-xs text-red-500">{alerts.alerts.expiringRegistrations} 条</span>
                      </div>
                      <div className="space-y-1 ml-5">
                        {alerts.alerts.expiringRegistrationsList?.map((r: any) => (
                          <button
                            key={r.id}
                            onClick={() => router.push(`/compliance/registrations/${r.id}`)}
                            className="w-full text-left text-xs text-[var(--color-text-secondary)] hover:text-blue-600 py-0.5"
                          >
                            · {r.name}（{r.registerNo || '无编号'}）- 到期 {r.expireDate?.slice(0, 10)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {alerts.alerts?.warningRegistrations > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">备案即将到期（60天内）</span>
                        <span className="text-xs text-amber-500">{alerts.alerts.warningRegistrations} 条</span>
                      </div>
                      <div className="space-y-1 ml-5">
                        {alerts.alerts.warningRegistrationsList?.slice(0, 3).map((r: any) => (
                          <button
                            key={r.id}
                            onClick={() => router.push(`/compliance/registrations/${r.id}`)}
                            className="w-full text-left text-xs text-[var(--color-text-secondary)] hover:text-blue-600 py-0.5"
                          >
                            · {r.name}（{r.registerNo || '无编号'}）- 到期 {r.expireDate?.slice(0, 10)}
                          </button>
                        ))}
                        {alerts.alerts.warningRegistrations > 3 && (
                          <div className="text-xs text-[var(--color-text-secondary)] ml-1">还有 {alerts.alerts.warningRegistrations - 3} 条...</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 检测报告到期 */}
                <div>
                  {alerts.alerts?.expiredTestReports > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <FileWarning className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs font-medium text-red-700">检测报告超过1年需更新</span>
                        <span className="text-xs text-red-500">{alerts.alerts.expiredTestReports} 条</span>
                      </div>
                      <div className="space-y-1 ml-5">
                        {alerts.alerts.expiredTestReportsList?.slice(0, 3).map((r: any) => (
                          <div key={r.id} className="text-xs text-[var(--color-text-secondary)] py-0.5">
                            · {r.productName} - {r.type}（{r.institution}，{r.completeDate?.slice(0, 10)}）
                          </div>
                        ))}
                        {alerts.alerts.expiredTestReports > 3 && (
                          <div className="text-xs text-[var(--color-text-secondary)] ml-1">还有 {alerts.alerts.expiredTestReports - 3} 条...</div>
                        )}
                      </div>
                    </div>
                  )}
                  {alerts.alerts?.warningTestReports > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">检测报告半年以上接近到期</span>
                        <span className="text-xs text-amber-500">{alerts.alerts.warningTestReports} 条</span>
                      </div>
                      <div className="space-y-1 ml-5">
                        {alerts.alerts.warningTestReportsList?.slice(0, 3).map((r: any) => (
                          <div key={r.id} className="text-xs text-[var(--color-text-secondary)] py-0.5">
                            · {r.productName} - {r.type}（{r.institution}，{r.completeDate?.slice(0, 10)}）
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 备案材料超期 */}
                <div>
                  {alerts.alerts?.criticalOverdueDocs > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <FileWarning className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs font-medium text-red-700">备案材料超30天未提交</span>
                        <span className="text-xs text-red-500">{alerts.alerts.criticalOverdueDocs} 条</span>
                      </div>
                      <div className="space-y-1 ml-5">
                        {alerts.alerts.criticalOverdueDocsList?.slice(0, 3).map((d: any) => (
                          <button
                            key={d.id}
                            onClick={() => router.push(`/compliance/registrations/${d.registrationId}`)}
                            className="w-full text-left text-xs text-[var(--color-text-secondary)] hover:text-blue-600 py-0.5"
                          >
                            · {d.productName || '未知产品'} - {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {alerts.alerts?.pendingDocs > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">备案材料待提交</span>
                        <span className="text-xs text-amber-500">{alerts.alerts.pendingDocs} 条</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 无预警 */}
                {!alerts.alerts?.expiringRegistrations && !alerts.alerts?.expiredTestReports && !alerts.alerts?.criticalOverdueDocs && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    暂无合规预警事项
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 完整流程进度 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-[var(--color-text)]">合规备案全流程</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text-secondary)]">整体进度</span>
              <span className="text-lg font-bold text-blue-600">{progressPercent}%</span>
            </div>
          </div>

          {/* 进度条 */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-blue-400 via-emerald-400 to-green-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 流程节点 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {STAGES.map((stage, index) => {
              const status = getStageStatus(stage)
              const StageIcon = stage.icon

              return (
                <button
                  key={stage.stage}
                  onClick={() => router.push(stage.href)}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    status === 'COMPLETED'
                      ? 'border-green-200 bg-green-50'
                      : status === 'IN_PROGRESS'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  {/* 步骤序号 */}
                  <div className={`absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    status === 'COMPLETED' ? 'bg-green-500' :
                    status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>

                  {/* 图标 */}
                  <div className={`mb-2 ${
                    status === 'COMPLETED' ? 'text-green-500' :
                    status === 'IN_PROGRESS' ? 'text-blue-500' : 'text-gray-300'
                  }`}>
                    <StageIcon className="w-8 h-8" />
                  </div>

                  {/* 标签 */}
                  <div className="text-sm font-medium text-center text-[var(--color-text)]">{stage.label}</div>

                  {/* 状态标签 */}
                  <div className={`mt-1 text-xs px-2 py-0.5 rounded-full ${
                    status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                    status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {status === 'COMPLETED' ? '已完成' : status === 'IN_PROGRESS' ? '进行中' : '待办'}
                  </div>

                  {/* 描述 */}
                  <div className="mt-1 text-[10px] text-[var(--color-text-secondary)] text-center leading-tight">
                    {stage.description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/compliance/registrations')}
            className="bg-[var(--color-card)] rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text)]">备案管理</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                {stats.total} 条记录，{stats.pending} 条待办
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>

          <button
            onClick={() => router.push('/compliance/test-entrustments')}
            className="bg-[var(--color-card)] rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <TestTube className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text)]">检测委托</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                {testEntrustments.length} 条记录，{testEntrustments.filter((i: any) => i.status !== 'COMPLETED').length} 条进行中
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>

          <button
            onClick={() => router.push('/rnd/materials')}
            className="bg-[var(--color-card)] rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text)]">原料合规筛查</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                原料禁用组分/限用物质排查
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>

          <button
            onClick={() => router.push('/compliance/registrations')}
            className="bg-[var(--color-card)] rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text)]">安全评估报告</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                关联备案记录查看安全评估状态
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>

          <button
            onClick={() => router.push('/compliance/standards')}
            className="bg-[var(--color-card)] rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text)]">检测标准配置</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                各市场检测标准限值管理
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>

          <button
            onClick={() => router.push('/compliance/regulations')}
            className="bg-[var(--color-card)] rounded-xl border p-5 flex items-center gap-4 hover:shadow-md transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
              <BookOpenCheck className="w-6 h-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text)]">法规数据库</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                {complianceStats?.regulations.total || 0} 条法规记录
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* 备案列表预览 */}
        <div className="bg-[var(--color-card)] rounded-xl border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-medium text-[var(--color-text)] text-sm">最近备案</h3>
            <button onClick={() => router.push('/compliance/registrations')} className="text-xs text-blue-600 hover:text-blue-700">
              查看全部
            </button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-4 w-full" />)}
            </div>
          ) : registrations.length === 0 ? (
            <div className="empty-state py-6">
              <div className="empty-state-title">暂无备案记录</div>
              <div className="empty-state-desc">点击右上角"新建备案"开始</div>
            </div>
          ) : (
            <div className="divide-y">
              {registrations.slice(0, 5).map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => router.push(`/compliance/registrations/${r.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg)] text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)] truncate">
                      {r.product?.name || '未命名产品'}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {r.registerNo || '暂无编号'} · {r.registerType}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'REGISTERED' ? 'bg-green-100 text-green-700' :
                      r.status === 'APPLYING' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'SUPPLEMENT' ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {r.status === 'REGISTERED' ? '已备案' :
                       r.status === 'APPLYING' ? '首次申请' :
                       r.status === 'SUPPLEMENT' ? '补充资料' :
                       r.status === 'CHANGE' ? '变更中' :
                       r.status === 'CANCELLED' ? '注销' : r.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
