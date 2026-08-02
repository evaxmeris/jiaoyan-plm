import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'ingredientCheck',
  permissions: {
    view: 'ingredientCheck.view',
    create: 'ingredientCheck.create',
    update: 'ingredientCheck.update',
    delete: 'ingredientCheck.delete',
  },
  detailInclude: {
    rawMaterial: { select: { id: true, nameCn: true, casNo: true } },
  },
})
