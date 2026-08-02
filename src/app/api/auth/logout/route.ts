import { NextResponse } from 'next/server'
import { successResponse } from '@/lib/api-response'

export async function POST() {
  const response = NextResponse.json(successResponse({ ok: true }))
  response.cookies.set('token', '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
