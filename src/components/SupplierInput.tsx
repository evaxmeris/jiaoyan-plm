'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-client'

interface SupplierCandidate {
  id: string
  name: string
  contact: string | null
  phone: string | null
}

interface Props {
  value: string
  onChange: (name: string, supplierId: string | null) => void
  placeholder?: string
  className?: string
}

/**
 * 供应商输入框（自动联想 + 档案选择）
 * - 输入时防抖搜索供应商档案，展示候选列表
 * - 点击候选 → 回填名称并携带 supplierId（已关联档案）
 * - 不选候选直接输入 → 仅保存名称（后端保存时按名称精确匹配，匹配到则自动关联）
 */
export default function SupplierInput({ value, onChange, placeholder, className }: Props) {
  const [candidates, setCandidates] = useState<SupplierCandidate[]>([])
  const [showList, setShowList] = useState(false)
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // 输入变化 → 防抖搜索（300ms）
  const handleInput = (v: string) => {
    // 文本变化时先清除已选关联；保存时后端会按名称再次精确匹配
    onChange(v, null)
    if (timer.current) clearTimeout(timer.current)
    if (!v.trim()) {
      setCandidates([])
      setShowList(false)
      return
    }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/supply/suppliers?search=${encodeURIComponent(v.trim())}&limit=8`)
        const json = await res.json()
        const list = json.data || json.suppliers || json.data?.suppliers || []
        setCandidates(Array.isArray(list) ? list : [])
        setShowList(true)
      } catch {
        setCandidates([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  // 点击候选 → 选中档案
  const pick = (c: SupplierCandidate) => {
    onChange(c.name, c.id)
    setCandidates([])
    setShowList(false)
  }

  // 点击组件外部关闭候选列表
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowList(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => candidates.length > 0 && setShowList(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)]">搜索中...</span>}
      {showList && candidates.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {candidates.map(c => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pick(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg)] flex items-center justify-between gap-2"
              >
                <span className="font-medium">{c.name}</span>
                {c.contact && <span className="text-xs text-[var(--color-text-secondary)]">{c.contact}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
