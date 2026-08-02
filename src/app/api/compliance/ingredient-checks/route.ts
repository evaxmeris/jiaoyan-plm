import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, IngredientCheckSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'ingredientCheck',
  permissions: { view: 'ingredientCheck.view', create: 'ingredientCheck.create', update: 'ingredientCheck.update', delete: 'ingredientCheck.delete' },
  include: {
    rawMaterial: { select: { id: true, nameCn: true, casNo: true } },
  },
  searchFields: ['checkItem'],
  orderBy: { updatedAt: 'desc' },
  beforeCreate: (body) => {
    autoValidate(IngredientCheckSchema)(body, undefined)
    return {
      rawMaterialId: body.rawMaterialId,
      checkItem: body.checkItem,
      referenceStd: body.referenceStd || null,
      limitValue: body.limitValue || null,
      actualValue: body.actualValue || null,
      result: body.result || 'PENDING',
      remark: body.remark || null,
      checkedBy: body.checkedBy || null,
      checkedAt: body.checkedAt ? new Date(body.checkedAt) : null,
    }
  },
})
