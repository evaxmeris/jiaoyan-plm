// 分销渠道详情 API（工厂模式）
import { createDetailHandlers } from '@/lib/crud-factory'

export const { GET, PUT, DELETE } = createDetailHandlers({
  model: 'distributionChannel',
  permissions: {
    view: 'distribution_channel.view',
    create: 'distribution_channel.create',
    update: 'distribution_channel.update',
    delete: 'distribution_channel.delete',
  },
  include: { _count: { select: { orders: true } } },
})
