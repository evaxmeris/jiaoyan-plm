'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Error boundary caught:', error?.message, error?.stack?.substring(0, 300))
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8">
        <h2 className="text-xl font-bold text-red-600 mb-2">加载失败</h2>
        <p className="text-gray-500 text-sm mb-4">{error?.message || '未知错误'}</p>
        <p className="text-gray-400 text-xs mb-4 font-mono">{error?.digest || ''}</p>
        <button onClick={reset} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
          重试
        </button>
      </div>
    </div>
  )
}
