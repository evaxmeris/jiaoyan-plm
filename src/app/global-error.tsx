'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('GlobalError caught:', error?.message, error?.stack)
  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">页面加载失败</h1>
          <p className="text-gray-500 mb-4">{error?.message || '发生了未知错误'}</p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  )
}
