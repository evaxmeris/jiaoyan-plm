import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'retainedSample',
  permissions: {
    view: 'retained_sample.view',
    create: 'retained_sample.create',
    update: 'retained_sample.update',
    delete: 'retained_sample.delete',
  },
  include: { product: { select: { id: true, name: true, brand: true, status: true } } },
  softDeleteField: 'isDeleted',
})
