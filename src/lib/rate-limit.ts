/**
 * 简单的内存速率限制器
 * 适用于单进程部署（非水平扩展场景）
 *
 * 用法：
 *   import { rateLimiter } from '@/lib/rate-limit'
 *
 *   const limiter = rateLimiter({ windowMs: 60000, max: 10 })
 *   const result = limiter.check('login:127.0.0.1')
 *   if (!result.allowed) return NextResponse.json({ error: result.error }, { status: 429 })
 */

interface RateLimitConfig {
  /** 时间窗口（毫秒），默认 60 秒 */
  windowMs?: number
  /** 窗口内最大请求数 */
  max: number
  /** 限制后的错误提示 */
  message?: string
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
  error?: string
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// 全局 Map：按 key 存储 { count, resetAt }
const store = new Map<string, RateLimitEntry>()

// 每 60 秒清理过期条目
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

export function rateLimiter(config: RateLimitConfig) {
  const windowMs = config.windowMs || 60_000
  const max = config.max
  const message = config.message || '请求过于频繁，请稍后再试'

  return {
    check(key: string): RateLimitResult {
      cleanup()
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now > entry.resetAt) {
        // 新窗口开始
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: max - 1, resetIn: windowMs }
      }

      entry.count++
      store.set(key, entry)

      if (entry.count > max) {
        return {
          allowed: false,
          remaining: 0,
          resetIn: entry.resetAt - now,
          error: message,
        }
      }

      return { allowed: true, remaining: max - entry.count, resetIn: entry.resetAt - now }
    },
  }
}

/**
 * 预定义的登录限速器：每个 IP 每分钟最多 10 次尝试
 */
export const loginLimiter = rateLimiter({
  windowMs: 60_000,
  max: 10,
  message: '登录尝试过于频繁，请 60 秒后再试',
})
