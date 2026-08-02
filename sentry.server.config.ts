// Sentry 服务端配置
// 该文件在 Next.js 服务端运行

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 0.0,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '0.1.0',
  // 忽略 401 和 404 错误
  ignoreErrors: ['401', 'Unauthorized', 'Not Found'],
})
