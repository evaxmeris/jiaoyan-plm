import { NextResponse } from 'next/server'

// 成功响应（单条记录）
export function successResponse<T>(data: T) {
  return { success: true, data }
}

// 列表响应（带分页）
export function successResponseWithPagination<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  return {
    success: true,
    data,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  }
}

// 错误响应
export function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}
