'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MARKET_OPTIONS, MARKET_LABELS, DEFAULT_MARKET, type Market } from '@/lib/validation'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface Regulation {
  id: string
  nameCn: string
  nameEn: string | null
  inciName: string | null
  casNo: string | null
  regulationType: 'PROHIBITED' | 'RESTRICTED' | 'ALLOWED'
  maxConcentration: number | null
  productTypeRestriction: string | null
  restrictionNote: string | null
  sourceRegulation: string
  category: string | null
  market: Market
}

export default function ComplianceScanPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [market, setMarket] = useState<Market>(DEFAULT_MARKET)
  const [results, setResults] = useState<Regulation[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) {
      setError('请输入原料名称或CAS号')
      return
    }
    setError('')
    setLoading(true)
    setSearched(true)

    try {
      const params = new URLSearchParams({ search: q })
      if (market) params.set('market', market)
      const res = await apiFetch(`/api/compliance/ingredient-regulations?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.data?.regulations || data.ingredientRegulations || [])
      } else {
        const err = await res.json()
        setError(err.error || '查询失败')
        setResults([])
      }
    } catch {
      setError('网络异常，请稍后重试')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const regulationTypeLabel = (t: string) => {
    switch (t) {
      case 'PROHIBITED': return '禁用'
      case 'RESTRICTED': return '限用'
      case 'ALLOWED': return '准用'
      default: return t
    }
  }

  const regulationTypeColor = (t: string) => {
    switch (t) {
      case 'PROHIBITED': return 'bg-red-100 text-red-700 border-red-200'
      case 'RESTRICTED': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'ALLOWED': return 'bg-green-100 text-green-700 border-green-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const badgeColor = (t: string) => {
    switch (t) {
      case 'PROHIBITED': return 'bg-red-500'
      case 'RESTRICTED': return 'bg-yellow-500'
      case 'ALLOWED': return 'bg-green-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/compliance')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">合规扫描中心</h1>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        {/* 搜索区 */}
        <div className="bg-[var(--color-card)] rounded-xl border p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">原料合规查询</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            输入原料中文名称、英文名称、INCI名称或CAS号，查询该原料在各市场的合规状态
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入原料名称 / CAS号..."
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <div className="flex items-center gap-3">
                <select
                  value={market}
                  onChange={e => setMarket(e.target.value as Market)}
                  className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  {MARKET_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  当前市场：{MARKET_LABELS[market]} — 仅显示该市场的法规
                </span>
              </div>
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  查询中...
                </>
              ) : (
                '合规扫描'
              )}
            </button>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </div>

        {/* 结果区 */}
        {searched && !loading && (
          results.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-[var(--color-text-secondary)]">未找到匹配的法规记录</div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                该原料可能不在<strong>{MARKET_LABELS[market]}</strong>的禁用/限用/准用目录中，或请尝试其他名称检索
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 统计摘要 */}
              <div className="flex gap-2 mb-3">
                <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">
                  准用 {results.filter(r => r.regulationType === 'ALLOWED').length}
                </span>
                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs">
                  限用 {results.filter(r => r.regulationType === 'RESTRICTED').length}
                </span>
                <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs">
                  禁用 {results.filter(r => r.regulationType === 'PROHIBITED').length}
                </span>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
                  市场：{MARKET_LABELS[market]}
                </span>
              </div>

              {results.map((reg) => (
                <div
                  key={reg.id}
                  className={`rounded-xl border p-4 ${regulationTypeColor(reg.regulationType)}`}
                >
                  {/* 原料标识 */}
                  <div className="flex items-start gap-3">
                    <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${badgeColor(reg.regulationType)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{reg.nameCn}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${regulationTypeColor(reg.regulationType)}`}>
                          {regulationTypeLabel(reg.regulationType)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium border bg-blue-50 text-blue-600 border-blue-200">
                          {MARKET_LABELS[reg.market] || reg.market}
                        </span>
                      </div>
                      <div className="text-xs opacity-75 mt-0.5 space-x-3">
                        {reg.nameEn && <span>英文: {reg.nameEn}</span>}
                        {reg.inciName && <span>INCI: {reg.inciName}</span>}
                        {reg.casNo && <span>CAS: {reg.casNo}</span>}
                      </div>
                    </div>
                  </div>

                  {/* 法规详情 */}
                  <div className="mt-3 pt-3 border-t border-current/10 space-y-1 text-xs">
                    {reg.category && (
                      <div className="flex gap-2">
                        <span className="font-medium">分类：</span>
                        <span>{reg.category}</span>
                      </div>
                    )}
                    {reg.maxConcentration != null && (
                      <div className="flex gap-2">
                        <span className="font-medium">最大允许浓度：</span>
                        <span>{reg.maxConcentration}%</span>
                      </div>
                    )}
                    {reg.productTypeRestriction && (
                      <div className="flex gap-2">
                        <span className="font-medium">产品类型限制：</span>
                        <span>{reg.productTypeRestriction}</span>
                      </div>
                    )}
                    {reg.restrictionNote && (
                      <div className="flex gap-2">
                        <span className="font-medium">限制说明：</span>
                        <span>{reg.restrictionNote}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <span className="font-medium">法规依据：</span>
                      <span className="text-blue-700">{reg.sourceRegulation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* 初始引导 */}
        {!searched && !loading && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⚖️</div>
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">合规扫描中心</h2>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
              输入原料名称或CAS号，查询该原料在各市场的合规状态（禁用/限用/准用成分），
              默认查询<strong>中国</strong>法规，可通过下拉菜单切换市场
            </p>
            <div className="mt-6 flex items-center justify-center gap-8 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                <span>禁用成分</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                <span>限用成分</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>准用成分</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
