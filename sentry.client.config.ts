// Sentry 客户端配置
// 该文件在浏览器端运行

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || ''

Sentry.init({
  dsn: SENTRY_DSN,
  // 生产环境下采样率 100%，开发环境降低采样
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 0.0,
  // 只上报生产环境的错误
  enabled: process.env.NODE_ENV === 'production',
  // 忽略 401 错误（用户未登录是正常行为）
  ignoreErrors: [
    '401',
    'Unauthorized',
    'NetworkError',
  ],
  // 中文环境
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '0.1.0',
})
