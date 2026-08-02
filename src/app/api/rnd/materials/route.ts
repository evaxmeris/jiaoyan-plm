import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, RawMaterialSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'rawMaterial',
  permissions: { view: 'material.view', create: 'material.create', update: 'material.update', delete: 'material.delete' },
  beforeCreate: autoValidate(RawMaterialSchema),
  searchFields: ['nameCn', 'nameEn', 'casNo', 'supplier'],
  orderBy: { updatedAt: 'desc' },
  softDeleteField: 'isDeleted',
})
