import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, EfficacyClaimSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'efficacyClaim',
  permissions: { view: 'efficacy_claim.view', create: 'efficacy_claim.create', update: 'efficacy_claim.update', delete: 'efficacy_claim.delete' },
  include: {
    product: { select: { name: true } },
  },
  orderBy: { updatedAt: 'desc' },
  beforeCreate: (body) => {
    autoValidate(EfficacyClaimSchema)(body, undefined)
    return {
      productDesignId: body.productDesignId || null,
      claimName: body.claimName,
      category: body.category || 'STANDARD',
      status: 'DRAFT',
      evidence: body.evidence || null,
      testEntrustmentId: body.testEntrustmentId || null,
      remark: body.remark || null,
    }
  },
  searchFields: ['claimName', 'evidence'],
})
