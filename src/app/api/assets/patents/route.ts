import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, PatentSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'patent',
  permissions: { view: 'patent.view', create: 'patent.create', update: 'patent.update', delete: 'patent.delete' },
  orderBy: { updatedAt: 'desc' },
  softDeleteField: 'isDeleted',
  paginate: false,
  beforeCreate: (body) => {
    autoValidate(PatentSchema)(body, undefined)
    return {
      name: body.name,
      type: body.type,
      inventor: body.inventor,
      applicationNo: body.applicationNo || null,
      applicant: body.applicant || '中山交研生物科技有限公司',
      techField: body.techField || null,
      status: body.status || 'DRAFT',
      applyDate: body.applyDate ? new Date(body.applyDate) : null,
      expireDate: body.expireDate ? new Date(body.expireDate) : null,
      remark: body.remark || null,
    }
  },
})
