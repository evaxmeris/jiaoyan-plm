/**
 * API 集成测试
 *
 * 这些测试依赖真实运行中的 Next.js 服务器（http://localhost:3002）
 * 和真实的数据库数据。请确保服务器已运行后再执行测试。
 *
 * 种子账号: admin@jiaoyan-bio.com / Admin123!
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://localhost:3002'

// ─── 全局 cookie（登录后填充） ───
let authCookie = ''

interface FetchOptions {
  method?: string
  body?: unknown
  cookie?: string
}

interface FetchResult {
  status: number
  data: any
  headers: Headers
}

async function api(path: string, options: FetchOptions = {}): Promise<FetchResult> {
  const { method = 'GET', body, cookie } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cookie) {
    headers['Cookie'] = cookie
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual', // don't follow redirects
  })

  let data: any
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  return { status: res.status, data, headers: res.headers }
}

function extractTokenCookie(res: FetchResult): string {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return ''
  // Parse the first cookie from Set-Cookie (format: "token=xxx; Path=/; HttpOnly; ...")
  const match = setCookie.match(/^([^;]+)/)
  return match ? match[0] : ''
}

// ─── 全局：先登录一次 ───
beforeAll(async () => {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@jiaoyan-bio.com', password: 'Admin123!' },
  })

  // 登录必须成功，否则后续测试无意义
  expect(res.status).toBe(200)
  expect(res.data).toHaveProperty('user')
  expect(res.data.user).toHaveProperty('id')
  expect(res.data.user).toHaveProperty('email', 'admin@jiaoyan-bio.com')

  authCookie = extractTokenCookie(res)
  expect(authCookie).toBeTruthy()
})

// ─────────────────────────────────────
// 1. 认证测试
// ─────────────────────────────────────
describe('API Integration', () => {
  describe('认证', () => {
    it('POST /api/auth/login（正确密码）→ 200 + user 对象', async () => {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@jiaoyan-bio.com', password: 'Admin123!' },
      })

      expect(res.status).toBe(200)
      expect(res.data).toHaveProperty('user')
      expect(res.data.user).toHaveProperty('id')
      expect(res.data.user).toHaveProperty('name')
      expect(res.data.user).toHaveProperty('email', 'admin@jiaoyan-bio.com')
      expect(res.data.user).toHaveProperty('role')
    })

    it('POST /api/auth/login（错误密码）→ 401', async () => {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@jiaoyan-bio.com', password: 'wrong-password' },
      })

      expect(res.status).toBe(401)
      expect(res.data).toHaveProperty('error')
    })

    it('GET /api/dashboard（无 cookie）→ 401', async () => {
      const res = await api('/api/dashboard')

      expect(res.status).toBe(401)
      expect(res.data).toHaveProperty('error')
    })
  })

  // ─────────────────────────────────────
  // 2. 采购全链路测试
  // ─────────────────────────────────────
  describe('采购全链路', () => {
    it('POST /api/purchase/applications（登录后创建）→ 201', async () => {
      const res = await api('/api/purchase/applications', {
        method: 'POST',
        cookie: authCookie,
        body: {
          title: '集成测试采购申请',
          totalAmount: 100,
          purpose: '自动集成测试用途',
          category: 'LAB_SUPPLIES',
          urgency: 'NORMAL',
          items: [
            { name: '测试物品A', quantity: 2, unit: '个', estimatedPrice: 50 },
          ],
        },
      })

      expect(res.status).toBe(201)
      expect(res.data).toHaveProperty('application')
      expect(res.data.application).toHaveProperty('id')
      expect(res.data.application).toHaveProperty('title', '集成测试采购申请')
      expect(res.data.application).toHaveProperty('code')
      expect(res.data.application).toHaveProperty('items')
      expect(Array.isArray(res.data.application.items)).toBe(true)
      expect(res.data.application.items.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /api/purchase/applications（登录后获取）→ 200', async () => {
      const res = await api('/api/purchase/applications', {
        cookie: authCookie,
      })

      expect(res.status).toBe(200)
      // 返回结构可能是 { applications: [...] } 或 { [model]: [...] }
      // 不硬编码，只验证存在数据字段
      expect(res.data).toBeTruthy()
    })

    it('GET /api/purchase/applications（无 cookie）→ 401', async () => {
      const res = await api('/api/purchase/applications')

      expect(res.status).toBe(401)
      expect(res.data).toHaveProperty('error')
    })
  })

  // ─────────────────────────────────────
  // 3. 通用 API 可用性
  // ─────────────────────────────────────
  describe('通用 API 可用性', () => {
    it('GET /api/rnd/materials → 200（物料列表）', async () => {
      const res = await api('/api/rnd/materials', { cookie: authCookie })

      expect(res.status).toBe(200)
      expect(res.data).toBeTruthy()
      // CRUD factory 返回 { rawMaterials: [...] } 或 { rawMaterials: [...], pagination: ... }
    })

    it('GET /api/supply/suppliers → 200（供应商列表）', async () => {
      const res = await api('/api/supply/suppliers', { cookie: authCookie })

      expect(res.status).toBe(200)
      expect(res.data).toBeTruthy()
    })

    it('GET /api/assets/trademarks → 200（商标列表）', async () => {
      const res = await api('/api/assets/trademarks', { cookie: authCookie })

      expect(res.status).toBe(200)
      expect(res.data).toBeTruthy()
    })

    it('GET /api/compliance/registrations → 200（合规注册列表）', async () => {
      const res = await api('/api/compliance/registrations', { cookie: authCookie })

      expect(res.status).toBe(200)
      expect(res.data).toBeTruthy()
    })

    it('GET /api/rnd/materials（无 cookie）→ 401', async () => {
      const res = await api('/api/rnd/materials')

      expect(res.status).toBe(401)
      expect(res.data).toHaveProperty('error')
    })

    it('GET /api/assets/trademarks（无 cookie）→ 401', async () => {
      const res = await api('/api/assets/trademarks')

      expect(res.status).toBe(401)
      expect(res.data).toHaveProperty('error')
    })
  })
})
