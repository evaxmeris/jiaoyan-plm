import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'pilotRun',
  permissions: {
    view: 'pilot_run.view',
    create: 'pilot_run.create',
    update: 'pilot_run.update',
    delete: 'pilot_run.delete',
  },
  include: { product: { select: { id: true, name: true, brand: true, category: true } } },
})
