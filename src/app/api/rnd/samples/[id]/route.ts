import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'sampleTask',
  permissions: {
    view: 'sample.view',
    create: 'sample.create',
    update: 'sample.update',
    delete: 'sample.delete',
  },
  include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  softDeleteField: 'isDeleted',
})
