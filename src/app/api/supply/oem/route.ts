import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, OEMContractSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'oEMContract',
  permissions: { view: 'oem.view', create: 'oem.create', update: 'oem.update', delete: 'oem.delete' },
  beforeCreate: autoValidate(OEMContractSchema),
  searchFields: ['contractNo', 'productName'],
  include: { supplier: { select: { name: true } } },
  orderBy: { createdAt: 'desc' },
  softDeleteField: 'isDeleted',
})
