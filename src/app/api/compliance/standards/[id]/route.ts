import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'complianceStandard',
  permissions: { view: 'registration.view', create: 'registration.create', update: 'registration.update', delete: 'registration.delete' },
  softDeleteField: undefined,
})
