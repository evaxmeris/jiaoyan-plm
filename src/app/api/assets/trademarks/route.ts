// 商标 CRUD API — 使用通用 CRUD 工厂
import { createCrudHandlers } from '@/lib/crud-factory'

import { TrademarkSchema, autoValidate } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'trademark',
  permissions: { view: 'trademark.view', create: 'trademark.create', update: 'trademark.update', delete: 'trademark.delete' },
  searchFields: ['name', 'applicationNo', 'registrationNo', 'owner'],
  orderBy: { updatedAt: 'desc' },
  softDeleteField: 'isDeleted',
  beforeCreate: autoValidate(TrademarkSchema),
})
