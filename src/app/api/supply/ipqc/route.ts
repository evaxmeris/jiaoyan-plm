// IPQC CRUD API — 使用通用 CRUD 工厂
import { createCrudHandlers } from '@/lib/crud-factory'

export const { GET, POST } = createCrudHandlers({
  model: 'iPQC',
  permissions: { view: 'ipqc.view', create: 'ipqc.create', update: 'ipqc.update', delete: 'ipqc.delete' },
  include: {
    product: { select: { name: true, brand: true } },
    oemContract: { select: { contractNo: true, productName: true } },
  },
  orderBy: { createdAt: 'desc' },
  searchFields: ['batchNo'],
})
