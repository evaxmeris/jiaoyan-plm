import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, ComplianceRegistrationSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'registration',
  permissions: { view: 'registration.view', create: 'registration.create', update: 'registration.update', delete: 'registration.delete' },
  include: { product: true, testEntrustments: { include: { product: true } } },
  orderBy: { updatedAt: 'desc' },
  softDeleteField: 'isDeleted',
  paginate: false,
  beforeCreate: (body) => {
    autoValidate(ComplianceRegistrationSchema)(body, undefined)
    return {
      productId: body.productId,
      registerNo: body.registerNo || null,
      registerType: body.registerType || '国产普通',
      applyDate: body.applyDate ? new Date(body.applyDate) : null,
      status: body.status || 'APPLYING',
      remark: body.remark || null,
    }
  },
})
