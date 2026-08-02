'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Box, FlaskConical, Syringe, FileSignature, Copyright,
  FileText, Factory, X, Loader2,
} from 'lucide-react'

interface SearchResult {
  id: string
  type: '原料' | '配方' | '产品' | '商标' | '专利' | '备案' | '供应商'
  label: string
  sublabel: string | null
  href: string
  match: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  '原料': Box,
  '配方': FlaskConical,
  '产品': Syringe,
  '商标': FileSignature,
  '专利': Copyright,
  '备案': FileText,
  '供应商': Factory,
}

const TYPE_ORDER: Record<string, number> = {
  '原料': 0,
  '配方': 1,
  '产品': 2,
  '商标': 3,
  '专利': 4,
  '备案': 5,
  '供应商': 6,
}

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // 自动聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setSelectedIndex(-1)
    }
  }, [open])

  // 防抖搜索
  useEffect(() => {
    if (!open) return
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        // 兼容标准响应格式 { success, data: { results } } 与旧格式顶层 results
        setResults(data.data?.results || data.results || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, open])

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          navigateTo(results[selectedIndex])
        } else if (results.length > 0) {
          navigateTo(results[0])
        }
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selectedIndex])

  const navigateTo = (result: SearchResult) => {
    onClose()
    router.push(result.href)
  }

  // 按类型分组
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  // 对类型排序
  const sortedTypes = Object.keys(groupedResults).sort(
    (a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99)
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 对话框 */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-xl mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label="全局搜索"
      >
        {/* 搜索输入区 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <Search className="w-5 h-5 text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(-1)
            }}
            placeholder="搜索原料、配方、产品、商标、专利..."
            className="flex-1 bg-transparent text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
            spellCheck={false}
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 快捷键提示 */}
        {!query.trim() && (
          <div className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            <p>输入关键词开始搜索</p>
            <p className="mt-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono">↑↓</kbd>
              {' '}选择{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono">Enter</kbd>
              {' '}跳转{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono">Esc</kbd>
              {' '}关闭
            </p>
          </div>
        )}

        {/* 搜索结果 */}
        {query.trim() && !loading && results.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            未找到匹配结果
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {sortedTypes.map((type) => {
              const items = groupedResults[type]
              const Icon = TYPE_ICONS[type] || Search

              return (
                <div key={type}>
                  {/* 分组标题 */}
                  <div className="px-5 py-1.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {type}
                    <span className="text-zinc-300 dark:text-zinc-600 font-normal">({items.length})</span>
                  </div>

                  {/* 结果项 */}
                  {items.map((item, idx) => {
                    const globalIdx = results.indexOf(item)
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => navigateTo(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          selectedIndex === globalIdx
                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        {/* 类型图标 */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          selectedIndex === globalIdx
                            ? 'bg-emerald-100 dark:bg-emerald-900/40'
                            : 'bg-zinc-100 dark:bg-zinc-800'
                        }`}>
                          <Icon className={`w-3.5 h-3.5 ${
                            selectedIndex === globalIdx
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-zinc-400'
                          }`} />
                        </div>

                        {/* 文本 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {item.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                              {item.match}
                            </span>
                          </div>
                          {item.sublabel && (
                            <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                              {item.sublabel}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
