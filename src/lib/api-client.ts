'use client'

/**
 * 客户端统一 fetch 封装
 *
 * 核心职责：401（登录失效/token 过期）统一处理 —— 清除无效 token、跳转登录页。
 *
 * 背景：middleware 只校验 cookie 存在性，token 过期时页面仍会渲染（200），
 * 但 API 校验失败返回 401。若页面 fetch 不做处理，会抛 unhandledRejection，
 * 用户看到的是空白页 + 控制台报错，而不是被引导回登录页。
 *
 * 用法：
 *   import { apiFetch } from '@/lib/api-client'
 *   const res = await apiFetch('/api/rnd/materials')
 */

let redirecting = false

/** 401 统一处理：清除失效 token 并跳转登录页（带防重入，避免多个并发请求重复跳转） */
export function handleUnauthorized() {
  if (redirecting) return
  redirecting = true
  // 尽力清除非 httpOnly 的 token（直接 cookie 设置对 httpOnly 无效）
  try {
    document.cookie = 'token=; path=/; max-age=0'
  } catch {
    /* 忽略 cookie 清除失败 */
  }
  // httpOnly cookie 无法用 JS 清除，必须调服务端 logout（Set-Cookie 清除）
  // fire-and-forget：不等响应，跳转后 middleware 验签兜底
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  const redirect = encodeURIComponent(window.location.pathname + window.location.search)
  window.location.href = `/login?redirect=${redirect}`
}

/** 带 401 处理的 fetch：登录失效时自动跳登录页，并抛出标记错误供调用方识别 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401) {
    handleUnauthorized()
    const err = new Error('登录已失效，请重新登录') as Error & { isUnauthorized?: boolean }
    err.isUnauthorized = true
    throw err
  }
  return res
}

/** 判断错误是否为登录失效（配合 apiFetch 使用，catch 中跳过 toast 避免打扰） */
export function isUnauthorizedError(e: unknown): boolean {
  return !!(e as any)?.isUnauthorized
}
