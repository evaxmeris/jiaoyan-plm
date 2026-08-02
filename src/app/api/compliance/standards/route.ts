import { createCrudHandlers } from '@/lib/crud-factory'

export const { GET, POST } = createCrudHandlers({
  model: 'complianceStandard',
  permissions: { view: 'registration.view', create: 'registration.create', update: 'registration.update', delete: 'registration.delete' },
  orderBy: { market: 'asc' },
  softDeleteField: undefined,
  paginate: false,
  searchFields: ['testItem', 'standardValue', 'regulationRef', 'remark'],
})
