import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_ROUTES = ['/login', '/register', '/verify']

/**
 * 校验 token 签名与有效期（jose，edge 兼容）。
 * middleware 之前只查 cookie 存在性，导致过期 token 放行页面、API 401，
 * 前端又无法清除 httpOnly cookie，形成 页面↔登录页 无限重定向循环。
 */
async function isTokenValid(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '')
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value
  const isAuthenticated = await isTokenValid(token)

  // 已登录用户访问登录页 → 跳转首页
  if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 公开路由始终放行
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // 公开 API 放行
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/anti-counterfeit/verify') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next()
  }

  // 静态资源放行
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // 根路径：未登录重定向到登录页
  if (pathname === '/') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // 未登录 → 重定向到登录页
  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
