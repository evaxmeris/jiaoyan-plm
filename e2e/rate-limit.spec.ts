import { test, expect } from '@playwright/test'

/**
 * 限速测试 — 独立文件，避免影响其他测试
 */
test.describe('API 限速', () => {
  test('登录接口限速 - 频繁请求会被拒绝', async ({ request }) => {
    let lastStatus = 0
    for (let i = 0; i < 11; i++) {
      const res = await request.post('/api/auth/login', {
        data: { email: 'ratelimit-bot@test.com', password: 'wrongpass!' },
      })
      lastStatus = res.status()
    }
    expect(lastStatus).toBe(429)
  })
})
