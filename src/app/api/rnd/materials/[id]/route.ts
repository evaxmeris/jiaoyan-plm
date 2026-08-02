import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'rawMaterial',
  permissions: { view: 'material.view', create: 'material.create', update: 'material.update', delete: 'material.delete' },
  softDeleteField: 'isDeleted',
})
