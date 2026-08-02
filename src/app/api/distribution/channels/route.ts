// 分销渠道 CRUD API（工厂模式）
import { createCrudHandlers } from '@/lib/crud-factory'
import { autoValidate, DistributionChannelSchema } from '@/lib/validation'

export const { GET, POST } = createCrudHandlers({
  model: 'distributionChannel',
  permissions: { view: 'distribution_channel.view', create: 'distribution_channel.create', update: 'distribution_channel.update', delete: 'distribution_channel.delete' },
  orderBy: { updatedAt: 'desc' },
  include: { _count: { select: { orders: true } } },
  paginate: false,
  beforeCreate: (body) => {
    autoValidate(DistributionChannelSchema)(body, undefined)
    return {
      name: body.name,
      type: body.type,
      contact: body.contact || null,
      phone: body.phone || null,
      commissionRate: body.commissionRate ? parseFloat(body.commissionRate) : null,
      status: body.status || 'ACTIVE',
      remark: body.remark || null,
    }
  },
})
