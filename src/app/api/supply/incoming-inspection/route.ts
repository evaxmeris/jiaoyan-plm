// IncomingInspection CRUD API — 使用通用 CRUD 工厂
import { createCrudHandlers } from '@/lib/crud-factory'

export const { GET, POST } = createCrudHandlers({
  model: 'incomingInspection',
  permissions: { view: 'incoming-inspection.view', create: 'incoming-inspection.create', update: 'incoming-inspection.update', delete: 'incoming-inspection.delete' },
  include: {
    rawMaterial: { select: { nameCn: true, unit: true } },
    batch: { select: { batchNo: true, internalBatch: true } },
  },
  orderBy: { createdAt: 'desc' },
  searchFields: ['supplierBatchNo'],
})
