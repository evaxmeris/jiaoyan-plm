import { NextRequest } from 'next/server'
import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, SupplierDocumentSchema } from '@/lib/validation'

const handlers = createCrudHandlers({
  model: 'supplierDocument',
  permissions: { view: 'supplier.view', create: 'supplier.update', update: 'supplier.update', delete: 'supplier.delete' },
  beforeCreate: autoValidate(SupplierDocumentSchema),
  orderBy: { createdAt: 'desc' },
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  url.searchParams.set('supplierId', id)
  const newReq = new NextRequest(url, { headers: req.headers })
  return handlers.GET(newReq)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  body.supplierId = id
  const newReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(body),
  })
  return handlers.POST(newReq)
}
