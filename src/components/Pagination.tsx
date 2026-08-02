'use client'

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: (number | 'ellipsis')[] = []
  const startPage = Math.max(1, page - 2)
  const endPage = Math.min(totalPages, page + 2)

  if (startPage > 1) {
    pages.push(1)
    if (startPage > 2) pages.push('ellipsis')
  }
  for (let i = startPage; i <= endPage; i++) pages.push(i)
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('ellipsis')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50 transition-colors"
      >
        上一页
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-2 text-gray-400 text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              p === page
                ? 'bg-emerald-600 text-white'
                : 'border hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50 transition-colors"
      >
        下一页
      </button>
    </div>
  )
}
