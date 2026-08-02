import { NextResponse } from 'next/server'

/**
 * 自定义业务错误类
 * 在 API handler 中直接 throw new AppError('消息', statusCode)，
 * withErrorHandler 会自动捕获并返回统一格式的错误响应。
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 高阶函数，包裹 API handler，统一处理错误
 *
 * 用法：
 *   export const GET = withErrorHandler(async (request) => {
 *     if (!user) throw new AppError('未登录', 401)
 *     return NextResponse.json(successResponse(data))
 *   })
 *
 * 不再需要每个路由自己写 try/catch。
 */
export function withErrorHandler(handler: (...args: any[]) => Promise<Response>) {
  return async (...args: any[]): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode },
        )
      }
      console.error('[API Error]', error)
      return NextResponse.json(
        { success: false, error: '服务器内部错误' },
        { status: 500 },
      )
    }
  }
}
