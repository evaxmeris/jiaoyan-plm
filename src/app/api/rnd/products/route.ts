import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, ProductDesignSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'productDesign',
  permissions: { view: 'product.view', create: 'product.create', update: 'product.update', delete: 'product.delete' },
  include: { formula: true },
  orderBy: { updatedAt: 'desc' },
  beforeCreate: (body) => {
    autoValidate(ProductDesignSchema)(body, undefined)
    return {
      name: body.name,
      brand: body.brand || '靘靓',
      category: body.category || null,
      capacity: body.capacity || null,
      status: body.status || 'CONCEPT',
      formulaId: body.formulaId || null,
      packagingBom: body.packagingBom || null,
      remark: body.remark || null,
    }
  },
})
