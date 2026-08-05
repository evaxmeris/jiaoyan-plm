'use client'

import Pagination from '@/components/Pagination'

export interface Column<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading: boolean
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  totalCount?: number
  page?: number
  totalPages?: number
  onPageChange?: (p: number) => void
  onCreateLabel?: string
  onCreate?: () => void
  emptyMessage?: string
}

export default function DataTable<T extends { id?: string }>({
  columns, data, loading, search, onSearchChange, searchPlaceholder,
  totalCount, page, totalPages, onPageChange, onCreateLabel, onCreate,
  emptyMessage,
}: Props<T>) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {onSearchChange && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={searchPlaceholder || '搜索...'}
              value={search || ''}
              onChange={e => { onSearchChange(e.target.value); onPageChange?.(1) }}
              className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm w-60 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {totalCount !== undefined && (
              <span className="text-sm text-[var(--color-text-secondary)]">共 {totalCount} 条</span>
            )}
          </div>
          {onCreate && (
            <button onClick={onCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors">
              + {onCreateLabel || '新建'}
            </button>
          )}
        </div>
      )}

      <div className="bg-[var(--color-card)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead className="bg-[var(--color-bg)]">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className={`text-left px-4 py-3 font-medium text-[var(--color-text-secondary)] ${col.className || ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--color-text-secondary)]">
                    {emptyMessage || '暂无数据'}
                  </td>
                </tr>
              ) : data.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-[var(--color-bg)] transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {page !== undefined && totalPages !== undefined && onPageChange && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[var(--color-border)]">
            <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
          </div>
        )}
      </div>
    </>
  )
}
