import { test, expect } from '@playwright/test'

/**
 * 交研生物 PLM - 端到端测试
 *
 * 前置条件：应用已在 http://localhost:3002 上运行
 * 种子数据管理员：admin@jiaoyan-bio.com / Admin123!
 */

const ADMIN_EMAIL = 'admin@jiaoyan-bio.com'
const ADMIN_PASSWORD = 'Admin123!'

test.describe('核心业务流程', () => {

  test('登录页正常渲染', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/交研生物/)
    await expect(page.getByText('产品研发管理系统')).toBeVisible()
    await expect(page.getByText('登录')).toBeVisible()
  })

  test('无效密码登录拒绝', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', 'wrong-password')
    await page.click('button[type="submit"]')
    await expect(page.getByText('邮箱或密码错误')).toBeVisible({ timeout: 8000 })
  })

  test('登录成功后跳转仪表盘', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    // 等待仪表盘加载
    await page.waitForTimeout(2000)
    await expect(page.getByText('你好')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('交研生物产品研发管理系统')).toBeVisible()
  })

  test('侧栏导航到各页面', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // 侧栏菜单默认展开，直接点击菜单项
    await page.locator('aside[aria-label="侧边导航"] button:has-text("原料管理")').first().click()
    await page.waitForURL('/rnd/materials')
    await expect(page).toHaveURL(/\/rnd\/materials/)
  })

  test('个人资料页面正常', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('个人信息')).toBeVisible()
  })

  test('退出登录后无法访问受保护页面', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // 点击用户头像下拉 -> 退出
    await page.locator('button:has-text("管理员")').first().click()
    await page.waitForTimeout(300)
    await page.getByText('退出登录').click()
    await page.waitForURL('/login')
  })

  test('健康检查端点在未登录时可访问', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
  })

  test('未登录时 API 返回 401', async ({ request }) => {
    const res = await request.get('/api/dashboard')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('未登录')
  })
})

test.describe('自动化业务链路', () => {

  test('测试1: 配方保存→成本自动计算', async ({ page }) => {
    // 登录（用 page 浏览器上下文，cookie 自动管理）
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // 侧栏菜单默认展开，直接点击成本核算
    await page.locator('aside[aria-label="侧边导航"] button:has-text("成本核算")').first().click()
    await page.waitForURL('/rnd/costing')
    await expect(page).toHaveURL(/\/rnd\/costing/)

    // API 验证：page.request 共享浏览器 cookie
    const formulasRes = await page.request.get('/api/rnd/formulas')
    expect(formulasRes.status()).toBe(200)

    const costingRes = await page.request.get('/api/rnd/costing')
    expect(costingRes.status()).toBe(200)
    const costingBody = await costingRes.json()
    expect(costingBody.costings).toBeDefined()
  })

  test('测试2: 采购API可访问', async ({ page }) => {
    // 先登录（浏览器上下文，不影响限速器）
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    const ordersRes = await page.request.get('/api/purchase/orders')
    expect(ordersRes.status()).toBe(200)
    const ordersBody = await ordersRes.json()
    expect(ordersBody.orders).toBeDefined()
  })

  test('测试3: 备案API可访问', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    const regRes = await page.request.get('/api/compliance/registrations')
    expect(regRes.status()).toBe(200)
    const regBody = await regRes.json()
    expect(regBody.registrations).toBeDefined()
  })

  test('测试4: API安全验证', async ({ request }) => {
    // 健康检查
    const healthRes = await request.get('/api/health')
    expect(healthRes.status()).toBe(200)

    // 未登录拒绝
    const dashRes = await request.get('/api/dashboard')
    expect(dashRes.status()).toBe(401)

    // 错误密码拒绝
    const badRes = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: 'wrongpass!' },
    })
    expect(badRes.status()).toBe(401)
  })
})
