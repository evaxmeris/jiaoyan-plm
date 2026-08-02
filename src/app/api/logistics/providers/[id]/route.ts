import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'logisticsProvider',
  permissions: { view: 'logistics_provider.view', create: 'logistics_provider.create', update: 'logistics_provider.update', delete: 'logistics_provider.delete' },
})
