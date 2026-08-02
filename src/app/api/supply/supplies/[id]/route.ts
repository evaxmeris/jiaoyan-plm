import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'supply',
  permissions: { view: 'supply.view', create: 'supply.create', update: 'supply.update', delete: 'supply.delete' },
  softDeleteField: 'isActive',
  include: { batches: { orderBy: { receiptDate: 'desc' } } },
})
