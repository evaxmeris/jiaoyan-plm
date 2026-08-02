import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, SupplierSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'supplier',
  permissions: { view: 'supplier.view', create: 'supplier.create', update: 'supplier.update', delete: 'supplier.delete' },
  beforeCreate: autoValidate(SupplierSchema),
  searchFields: ['name', 'contactPerson'],
  orderBy: { createdAt: 'desc' },
  softDeleteField: 'isDeleted',
})
