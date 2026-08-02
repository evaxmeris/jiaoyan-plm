import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

interface SearchResult {
  id: string
  type: '原料' | '配方' | '产品' | '商标' | '专利' | '备案' | '供应商'
  label: string
  sublabel: string | null
  href: string
  match: string
}

// GET /api/search?q=关键词 — 跨模块全局搜索
export async function GET(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'search.view', user.id)) {
    return errorResponse('权限不足', 403)
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return NextResponse.json(successResponse({ results: [] }))
  }

  const results: SearchResult[] = []

  await Promise.all([
    // 1. 原料 — nameCn, nameEn, casNo（前20条）
    (async () => {
      const items = await prisma.rawMaterial.findMany({
        where: {
          isDeleted: false,
          OR: [
            { nameCn: { contains: q } },
            { nameEn: { contains: q } },
            { casNo: { contains: q } },
          ],
        },
        select: { id: true, nameCn: true, nameEn: true, casNo: true },
        take: 20,
      })
      for (const item of items) {
        let match = '名称'
        if (item.casNo?.includes(q)) match = 'CAS号'
        else if (item.nameEn?.includes(q)) match = '英文名'
        results.push({
          id: item.id,
          type: '原料',
          label: item.nameCn,
          sublabel: item.casNo || item.nameEn || null,
          href: '/rnd/materials',
          match,
        })
      }
    })(),

    // 2. 配方 — name, code（前20条）
    (async () => {
      const items = await prisma.formula.findMany({
        where: {
          isDeleted: false,
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
          ],
        },
        select: { id: true, name: true, code: true },
        take: 20,
      })
      for (const item of items) {
        const match = item.code?.includes(q) ? '编号' : '名称'
        results.push({
          id: item.id,
          type: '配方',
          label: item.name,
          sublabel: item.code,
          href: '/rnd/formulas',
          match,
        })
      }
    })(),

    // 3. 产品 — name（前20条）
    (async () => {
      const items = await prisma.productDesign.findMany({
        where: {
          isDeleted: false,
          name: { contains: q },
        },
        select: { id: true, name: true, status: true },
        take: 20,
      })
      for (const item of items) {
        results.push({
          id: item.id,
          type: '产品',
          label: item.name,
          sublabel: item.status,
          href: '/rnd/products',
          match: '名称',
        })
      }
    })(),

    // 4. 商标 — name, registerNo（前10条）
    (async () => {
      const items = await prisma.trademark.findMany({
        where: {
          isDeleted: false,
          OR: [
            { name: { contains: q } },
            { registrationNo: { contains: q } },
          ],
        },
        select: { id: true, name: true, registrationNo: true },
        take: 10,
      })
      for (const item of items) {
        const match = item.registrationNo?.includes(q) ? '注册号' : '名称'
        results.push({
          id: item.id,
          type: '商标',
          label: item.name,
          sublabel: item.registrationNo || null,
          href: '/assets/trademarks',
          match,
        })
      }
    })(),

    // 5. 专利 — name, patentNo（前10条）
    (async () => {
      const items = await prisma.patent.findMany({
        where: {
          isDeleted: false,
          OR: [
            { name: { contains: q } },
            { patentNo: { contains: q } },
          ],
        },
        select: { id: true, name: true, patentNo: true },
        take: 10,
      })
      for (const item of items) {
        const match = item.patentNo?.includes(q) ? '专利号' : '名称'
        results.push({
          id: item.id,
          type: '专利',
          label: item.name,
          sublabel: item.patentNo || null,
          href: '/assets/patents',
          match,
        })
      }
    })(),

    // 6. 备案 — registerNo（前10条）
    (async () => {
      const items = await prisma.registration.findMany({
        where: {
          isDeleted: false,
          registerNo: { contains: q },
        },
        select: { id: true, registerNo: true, status: true },
        take: 10,
      })
      for (const item of items) {
        results.push({
          id: item.id,
          type: '备案',
          label: item.registerNo || '',
          sublabel: item.status,
          href: '/compliance/registrations',
          match: '备案号',
        })
      }
    })(),

    // 7. 供应商 — name（前10条）
    (async () => {
      const items = await prisma.supplier.findMany({
        where: {
          isDeleted: false,
          name: { contains: q },
        },
        select: { id: true, name: true },
        take: 10,
      })
      for (const item of items) {
        results.push({
          id: item.id,
          type: '供应商',
          label: item.name,
          sublabel: null,
          href: '/supply/suppliers',
          match: '名称',
        })
      }
    })(),
  ])

  return NextResponse.json(successResponse({ results }))
}
