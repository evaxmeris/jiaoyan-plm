// OQC CRUD API — 使用通用 CRUD 工厂
import { createCrudHandlers } from '@/lib/crud-factory'

export const { GET, POST } = createCrudHandlers({
  model: 'oQC',
  permissions: { view: 'oqc.view', create: 'oqc.create', update: 'oqc.update', delete: 'oqc.delete' },
  include: {
    product: { select: { name: true, brand: true } },
  },
  orderBy: { createdAt: 'desc' },
  searchFields: ['batchNo'],
})
