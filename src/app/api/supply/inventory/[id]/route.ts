import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'rawMaterialBatch',
  permissions: { view: 'inventory.view', create: 'inventory.create', update: 'inventory.update', delete: 'inventory.delete' },
  include: { rawMaterial: { select: { nameCn: true, unit: true } } },
})
