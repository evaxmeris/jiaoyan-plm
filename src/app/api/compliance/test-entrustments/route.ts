import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, TestEntrustmentSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'testEntrustment',
  permissions: { view: 'test_entrustment.view', create: 'test_entrustment.create', update: 'test_entrustment.update', delete: 'test_entrustment.delete' },
  searchFields: ['productName', 'institution', 'reportNo'],
  orderBy: { updatedAt: 'desc' },
  softDeleteField: 'isDeleted',
  beforeCreate: (body) => {
    autoValidate(TestEntrustmentSchema)(body, undefined)
    return {
      registrationId: body.registrationId || null,
      productDesignId: body.productDesignId || null,
      productName: body.productName,
      type: body.type || null,
      testItems: body.testItems || null,
      institution: body.institution,
      reportNo: body.reportNo || null,
      reportUrl: body.reportUrl || null,
      sampleBatch: body.sampleBatch || null,
      applyDate: body.applyDate ? new Date(body.applyDate) : null,
      sendDate: body.sendDate ? new Date(body.sendDate) : null,
      completeDate: body.completeDate ? new Date(body.completeDate) : null,
      reportDate: body.reportDate ? new Date(body.reportDate) : null,
      result: body.result || 'PENDING',
      status: body.status || 'PENDING',
      cost: body.cost ? parseFloat(body.cost) : null,
      remark: body.remark || null,
    }
  },
})
