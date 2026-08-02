import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'supplier',
  permissions: { view: 'supplier.view', create: 'supplier.create', update: 'supplier.update', delete: 'supplier.delete' },
  softDeleteField: 'isDeleted',
})
