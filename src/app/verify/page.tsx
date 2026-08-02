'use client'

import { useState } from 'react'
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

interface VerifyResult {
  authentic: boolean
  firstVerified: boolean
  firstVerifiedAt: string | null
  verifyCount: number
  productName: string | null
  message: string
}

export default function VerifyPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    setLoading(true)
    setResult(null)
    setError('')

    try {
      const res = await fetch('/api/anti-counterfeit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '验证失败，请稍后重试')
      } else {
        setResult(data)
      }
    } catch {
      setError('网络错误，请检查网络连接后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* 品牌Header */}
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-lg font-bold text-emerald-900">S²R · 正品验证</h1>
            <p className="text-xs text-emerald-600">S²R / QEVORIA 品牌官方防伪查询系统</p>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* 验证输入区 */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 mb-6">
          <h2 className="text-xl font-semibold text-emerald-900 mb-2">产品防伪验证</h2>
          <p className="text-sm text-gray-500 mb-6">请刮开产品包装上的防伪涂层，输入16~18位防伪码进行验证</p>

          <div className="flex gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="请输入防伪码"
              className="flex-1 px-4 py-3 border-2 border-emerald-200 rounded-xl text-lg tracking-widest
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200
                         placeholder:text-gray-300 uppercase"
              maxLength={30}
              disabled={loading}
            />
            <button
              onClick={handleVerify}
              disabled={loading || !code.trim()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium
                         hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              验证
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 验证结果 */}
        {result && (
          <div className={`rounded-2xl shadow-lg border p-8 ${
            result.authentic
              ? result.firstVerified
                ? 'bg-green-50 border-green-200'
                : 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              {result.authentic && result.firstVerified && (
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              )}
              {result.authentic && !result.firstVerified && (
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              )}
              {!result.authentic && (
                <XCircle className="w-10 h-10 text-red-600" />
              )}
              <div>
                <h3 className={`text-lg font-bold ${
                  result.authentic
                    ? result.firstVerified ? 'text-green-800' : 'text-amber-800'
                    : 'text-red-800'
                }`}>
                  {result.authentic ? (result.firstVerified ? '✅ 正品验证通过' : '⚠️ 重复查询') : '❌ 验证未通过'}
                </h3>
                <p className={`text-sm ${
                  result.authentic
                    ? result.firstVerified ? 'text-green-600' : 'text-amber-600'
                    : 'text-red-600'
                }`}>
                  {result.message}
                </p>
              </div>
            </div>

            {/* 详细信息 */}
            <div className="bg-white/60 rounded-xl p-4 space-y-2 text-sm">
              {result.productName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">产品名称</span>
                  <span className="font-medium text-gray-800">{result.productName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">防伪码</span>
                <span className="font-mono font-medium text-gray-800">{code.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">查询次数</span>
                <span className="font-medium text-gray-800">{result.verifyCount} 次</span>
              </div>
              {result.firstVerifiedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">首次查询</span>
                  <span className="font-medium text-gray-800">
                    {new Date(result.firstVerifiedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 品牌信息 */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            中山交研生物科技有限公司 · S²R / QEVORIA
          </p>
        </div>
      </main>
    </div>
  )
}
