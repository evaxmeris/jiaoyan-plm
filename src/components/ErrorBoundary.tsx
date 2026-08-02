'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              页面加载失败
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {this.state.error?.message || '发生了意外错误'}
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
            <details className="mt-4 text-left">
              <summary className="text-xs text-[var(--color-text-secondary)] cursor-pointer">
                查看错误详情
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400 overflow-auto max-h-48">
                {this.state.error?.stack || this.state.error?.message || '无详细信息'}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
