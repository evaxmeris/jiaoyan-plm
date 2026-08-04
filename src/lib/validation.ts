import { z } from 'zod'

// ─── 通用 ────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
})

// ─── 登录 ────────────────

export const LoginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位').max(128),
})

// ─── 注册 ────────────────

export const RegisterSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位').max(128),
  name: z.string().min(1, '姓名不能为空').max(50),
  department: z.string().nullable().optional(),
})

// ─── 采购申请 ────────────────

const PurchaseItemSchema = z.object({
  name: z.string().min(1, '物品名称不能为空'),
  specification: z.string().nullable().optional(),
  quantity: z.coerce.number().min(0.001, '数量必须大于 0'),
  unit: z.string().default('个'),
  estimatedPrice: z.coerce.number().min(0, '估价不能为负').default(0),
  totalPrice: z.coerce.number().min(0).optional(),
  rawMaterialId: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

export const PurchaseApplicationSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  category: z.enum(['RAW_MATERIAL', 'PACKAGING', 'LAB_SUPPLIES', 'EQUIPMENT', 'OFFICE_SUPPLIES', 'GIFTS', 'OTHER']).default('RAW_MATERIAL'),
  supplier: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  totalAmount: z.coerce.number().min(0, '金额不能为负'),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  purpose: z.string().min(1, '采购用途不能为空'),
  items: z.array(PurchaseItemSchema).min(1, '至少需要一个采购项'),
})

// ─── 采购订单 ────────────────

const OrderItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().min(0.001),
  unit: z.string().default('个'),
  unitPrice: z.coerce.number().min(0).default(0),
  totalPrice: z.coerce.number().min(0).optional(),
  remark: z.string().nullable().optional(),
})

export const PurchaseOrderSchema = z.object({
  applicationId: z.string().min(1),
  supplierId: z.string().min(1, '请选择供应商'),
  items: z.array(OrderItemSchema).min(1),
  totalAmount: z.coerce.number().min(0),
  deliveryDate: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

// ─── 预算 ────────────────

export const BudgetSchema = z.object({
  department: z.string().min(1, '部门不能为空'),
  fiscalYear: z.coerce.number().int().min(2020).max(2100),
  totalAmount: z.coerce.number().min(0, '预算金额不能为负'),
  remark: z.string().nullable().optional(),
})

// ─── 服务合同 ────────────────

export const ServiceContractSchema = z.object({
  code: z.string().min(1, '合同编号不能为空'),
  title: z.string().min(1, '合同标题不能为空').max(200),
  partyA: z.string().min(1, '甲方不能为空'),
  partyB: z.string().min(1, '乙方不能为空'),
  totalAmount: z.coerce.number().min(0, '金额不能为负'),
  startDate: z.string().min(1, '开始日期不能为空'),
  endDate: z.string().min(1, '结束日期不能为空'),
  paymentType: z.enum(['ONETIME', 'INSTALLMENT', 'MILESTONE']).default('ONETIME'),
  remark: z.string().nullable().optional(),
})

// ─── 商标 ────────────────

export const TrademarkSchema = z.object({
  name: z.string().min(1, '商标名称不能为空').max(100),
  type: z.enum(['WORD', 'FIGURATIVE', 'COMBINATION', 'SOUND', 'THREE_DIMENSIONAL', 'COLOR']).default('WORD'),
  category: z.string().min(1, '类别不能为空'),
  applicationNo: z.string().nullable().optional(),
  owner: z.string().min(1, '申请人不能为空'),
  status: z.string().default('DRAFT'),
})

// ─── 专利 ────────────────

export const PatentSchema = z.object({
  name: z.string().min(1, '专利名称不能为空').max(200),
  type: z.enum(['INVENTION', 'UTILITY_MODEL', 'DESIGN']).default('INVENTION'),
  inventor: z.string().min(1, '发明人不能为空'),
  applicant: z.string().min(1, '申请人不能为空'),
  techField: z.string().nullable().optional(),
  status: z.string().default('DRAFT'),
})

// ─── 供应商 ────────────────

export const SupplierSchema = z.object({
  name: z.string().min(1, '供应商名称不能为空'),
  type: z.enum(['RAW_MATERIAL', 'PACKAGING', 'OEM', 'TESTING', 'CERTIFICATION_BODY', 'OTHER']).default('RAW_MATERIAL'),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

// ─── 原料 ────────────────

export const RawMaterialSchema = z.object({
  nameCn: z.string().min(1, '原料中文名不能为空'),
  nameEn: z.string().nullable().optional(),
  casNo: z.string().nullable().optional(),
  inciName: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  function: z.string().nullable().optional(),
  unit: z.string().default('kg'),
  currentStock: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
})

// ─── 报销 ────────────────

export const ReimbursementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  amount: z.coerce.number().min(0.01, '金额必须大于 0'),
  category: z.enum(['TRAVEL', 'OFFICE', 'ENTERTAINMENT', 'EQUIPMENT', 'OTHER']).default('OTHER'),
  description: z.string().nullable().optional(),
})

// ─── 供应商文档 ────────────────

export const SupplierDocumentSchema = z.object({
  name: z.string().min(1, '文档名称不能为空'),
  type: z.enum(['BUSINESS_LICENSE', 'PRODUCTION_LICENSE', 'CERTIFICATION', 'NDA', 'QUALITY_AGREEMENT', 'COA', 'MSDS', 'TDS', 'GMP', 'ISO22716']),
  expireDate: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
})

// ─── 供应商审核 ────────────────

export const SupplierAuditSchema = z.object({
  auditDate: z.string().min(1, '审核日期不能为空'),
  auditor: z.string().min(1, '审核人不能为空'),
  result: z.enum(['PASS', 'FAIL']),
  score: z.coerce.number().min(0).max(100).nullable().optional(),
  remark: z.string().nullable().optional(),
})

// ─── OEM 合同 ────────────────

export const OEMContractSchema = z.object({
  productName: z.string().min(1, '产品名称不能为空'),
  contractNo: z.string().min(1, '合同编号不能为空'),
  unitPrice: z.coerce.number().min(0, '单价不能为负'),
  moq: z.coerce.number().int().min(1, 'MOQ 必须大于 0'),
  leadTime: z.coerce.number().int().min(1, '交期必须大于 0'),
  startDate: z.string().min(1, '开始日期不能为空'),
  endDate: z.string().min(1, '结束日期不能为空'),
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']).default('ACTIVE'),
})

// ─── 到货质检 ────────────────

export const IncomingInspectionSchema = z.object({
  rawMaterialId: z.string().min(1, '原料不能为空'),
  batchId: z.string().nullable().optional(),
  inspector: z.string().min(1, '检验人不能为空'),
  result: z.enum(['PASS', 'CONDITIONAL', 'FAIL']),
  quantity: z.coerce.number().min(0.001, '数量必须大于 0'),
  remark: z.string().nullable().optional(),
})

// ─── 制程检验 ────────────────

export const IPQCSchema = z.object({
  batchNo: z.string().min(1, '批次号不能为空'),
  inspector: z.string().min(1, '检验人不能为空'),
  stage: z.enum(['PRODUCTION', 'FILLING', 'PACKAGING', 'LABELING']),
  result: z.enum(['PASS', 'CONDITIONAL', 'FAIL']),
  remark: z.string().nullable().optional(),
})

// ─── 出厂检验 ────────────────

export const OQCSchema = z.object({
  batchNo: z.string().min(1, '批次号不能为空'),
  inspector: z.string().min(1, '检验人不能为空'),
  result: z.enum(['PASS', 'CONDITIONAL', 'FAIL']),
  remark: z.string().nullable().optional(),
})

// ─── 产品注册/备案 ────────────────

export const ComplianceRegistrationSchema = z.object({
  productId: z.string().min(1, '产品不能为空'),
  registerNo: z.string().nullable().optional(),
  status: z.enum(['APPLYING', 'SUPPLEMENT', 'REGISTERED', 'CHANGE', 'CANCELLED']).default('APPLYING'),
  applicationDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
})

// ─── 安全评估报告 (CPSR) ────────────────

export const SafetyAssessmentSchema = z.object({
  assessor: z.string().min(1, '评估机构不能为空'),
  assessDate: z.string().nullable().optional(),
  reportNo: z.string().nullable().optional(),
  conclusion: z.enum(['PASS', 'CONDITIONAL', 'FAIL']),
  fileUrl: z.string().nullable().optional(),
  remark: z.string().max(500).nullable().optional(),
})

// ─── 样品任务 ────────────────

export const SampleTaskSchema = z.object({
  productDesignId: z.string().min(1, '产品不能为空'),
  batchNo: z.string().min(1, '批次号不能为空'),
  quantity: z.coerce.number().int().min(1, '数量必须大于 0'),
  dueDate: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING'),
  remark: z.string().nullable().optional(),
})

// ─── 产品设计 ────────────────

export const ProductDesignSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(200),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.enum(['CONCEPT', 'DESIGNING', 'SAMPLING', 'TESTING', 'REGISTERING', 'READY', 'LAUNCHED', 'DISCONTINUED']).default('CONCEPT'),
  description: z.string().nullable().optional(),
})

// ─── 功效宣称 ────────────────

export const EfficacyClaimSchema = z.object({
  productDesignId: z.string().nullable().optional(),
  claimName: z.string().min(1, '宣称名称不能为空').max(100),
  category: z.enum(['STANDARD', 'NEW']).default('STANDARD'),
  status: z.enum(['DRAFT', 'REVIEWING', 'APPROVED', 'REJECTED']).default('DRAFT'),
  evidence: z.string().nullable().optional(),
  testEntrustmentId: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

// ─── 原料检测 ────────────────

export const IngredientCheckSchema = z.object({
  rawMaterialId: z.string().min(1, '原料不能为空'),
  checkItem: z.string().min(1, '检测项目不能为空'),
  referenceStd: z.string().nullable().optional(),
  limitValue: z.string().nullable().optional(),
  actualValue: z.string().nullable().optional(),
  result: z.string().default('PENDING'),
  remark: z.string().nullable().optional(),
  checkedBy: z.string().nullable().optional(),
  checkedAt: z.string().nullable().optional(),
})

// ─── 市场/法域 ────────────────
// 与 Prisma Market 枚举同步
export const MARKET_VALUES = [
  'CHINA', 'EU', 'US', 'KSA', 'JP', 'KR', 'MY', 'PH', 'RU', 'GB',
] as const
export type Market = (typeof MARKET_VALUES)[number]

export const MARKET_LABELS: Record<Market, string> = {
  CHINA: '中国',
  EU: '欧盟',
  US: '美国',
  KSA: '沙特',
  JP: '日本',
  KR: '韩国',
  MY: '马来西亚',
  PH: '菲律宾',
  RU: '俄罗斯',
  GB: '英国',
}

export const MARKET_OPTIONS = MARKET_VALUES.map((v) => ({
  value: v,
  label: MARKET_LABELS[v],
}))

export const DEFAULT_MARKET: Market = 'CHINA'

// ─── 委托检测 ────────────────

export const TestEntrustmentSchema = z.object({
  registrationId: z.string().nullable().optional(),
  productDesignId: z.string().nullable().optional(),
  productName: z.string().min(1, '产品名称不能为空'),
  type: z.string().nullable().optional(),
  testItems: z.any().nullable().optional(),
  institution: z.string().min(1, '检测机构不能为空'),
  reportNo: z.string().nullable().optional(),
  reportUrl: z.string().nullable().optional(),
  sampleBatch: z.string().nullable().optional(),
  applyDate: z.string().nullable().optional(),
  sendDate: z.string().nullable().optional(),
  completeDate: z.string().nullable().optional(),
  reportDate: z.string().nullable().optional(),
  result: z.string().default('PENDING'),
  status: z.string().default('PENDING'),
  cost: z.coerce.number().min(0, '费用不能为负').nullable().optional(),
  remark: z.string().nullable().optional(),
})

// ─── 分销渠道 ────────────────

export const DistributionChannelSchema = z.object({
  name: z.string().min(1, '渠道名称不能为空'),
  type: z.enum(['PLATFORM', 'DISTRIBUTOR', 'RETAILER', 'OFFLINE', 'OTHER']),
  contact: z.string().nullable().optional(),
  commissionRate: z.coerce.number().min(0).max(100).nullable().optional(),
})

// ─── 分销订单 ────────────────

export const DistributionOrderSchema = z.object({
  channelId: z.string().min(1, '分销渠道不能为空'),
  orderNo: z.string().min(1, '订单号不能为空'),
  totalAmount: z.coerce.number().min(0, '金额不能为负'),
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED']).default('PENDING'),
  items: z.any().nullable().optional(),
})

// ─── 物流发货 ────────────────

export const LogisticsShippingSchema = z.object({
  orderNo: z.string().min(1, '订单号不能为空'),
  provider: z.string().nullable().optional(),
  trackingNo: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED']).default('PENDING'),
  weight: z.coerce.number().min(0).nullable().optional(),
  cost: z.coerce.number().min(0, '费用不能为负').nullable().optional(),
})

// ─── 配方 ────────────────

const FormulaItemSchema = z.object({
  rawMaterialId: z.string().min(1, '原料不能为空'),
  percentage: z.coerce.number().min(0).max(100),
  weight: z.coerce.number().min(0).nullable().optional(),
  cost: z.coerce.number().min(0).nullable().optional(),
  remark: z.string().nullable().optional(),
})

export const FormulaSchema = z.object({
  name: z.string().min(1, '配方名称不能为空').max(200),
  // type 为历史遗留必填字段：Formula 模型无此列、前端亦不传，保留可选兼容
  type: z.string().optional(),
  productDesignId: z.string().nullable().optional(),
  version: z.string().optional(),
  status: z.string().default('DEVELOPING'),
  items: z.array(FormulaItemSchema).optional(),
})

// ─── 原料批次 ────────────────

export const RawMaterialBatchSchema = z.object({
  rawMaterialId: z.string().min(1, '原料不能为空'),
  batchNo: z.string().min(1, '批次号不能为空'),
  quantity: z.coerce.number().min(0.001, '数量必须大于 0'),
  receiptDate: z.string().min(1, '收货日期不能为空'),
  supplier: z.string().min(1, '供应商不能为空'),
  expireDate: z.string().nullable().optional(),
  status: z.string().default('IN_STOCK'),
  remark: z.string().nullable().optional(),
})

// ─── 产品批次（成品库存）────────
//
export const ProductBatchSchema = z.object({
  productId: z.string().min(1, '产品不能为空'),
  batchNo: z.string().min(1, '批次号不能为空'),
  productionDate: z.string().min(1, '生产日期不能为空'),
  expireDate: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1, '数量必须大于 0'),
  minStock: z.coerce.number().int().min(0).default(0),
  status: z.enum(['IN_STOCK', 'USED', 'RETURNED', 'EXPIRED']).default('IN_STOCK'),
  registrationNo: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

export const StockOutSchema = z.object({
  quantity: z.coerce.number().int().min(1, '出库数量必须大于 0'),
  reason: z.enum(['SALE', 'DAMAGE', 'RECALL', 'GIFT', 'OTHER']),
  operatorName: z.string().min(1, '操作人不能为空'),
  remark: z.string().nullable().optional(),
})

// ─── 服务合同支付 ────────────────

export const ServiceContractPaymentSchema = z.object({
  contractId: z.string().min(1, '合同不能为空'),
  amount: z.coerce.number().min(0.01, '支付金额必须大于 0'),
  payDate: z.string().min(1, '支付日期不能为空'),
  method: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
})

// ─── 辅助函数 ────────────────

/**
 * 验证请求体并返回解析后的数据或错误响应
 */
export function validateOrError<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string; errors: Record<string, string> } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }
  const firstError = result.error.issues?.[0]?.message ?? '输入数据验证失败'
  return { success: false, error: firstError, errors }
}

/**
 * 验证请求体，失败时返回 NextResponse
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  try {
    const body = await request.json()
    const result = validateOrError(schema, body)
    if (!result.success) {
      const { NextResponse } = await import('next/server')
      return {
        success: false,
        response: NextResponse.json({ error: result.error, errors: result.errors }, { status: 400 }),
      }
    }
    return result
  } catch {
    const { NextResponse } = await import('next/server')
    return {
      success: false,
      response: NextResponse.json({ error: '请求体不是有效的 JSON' }, { status: 400 }),
    }
  }
}

/**
 * 自动验证辅助函数 —— 供工厂路由的 beforeCreate / beforeUpdate 使用
 *
 * @example
 * ```typescript
 * export const { GET, POST } = createCrudHandlers({
 *   model: 'supplier',
 *   permissions: { view: 'supplier.view', create: 'supplier.create' },
 *   beforeCreate: autoValidate(SupplierSchema),
 * })
 * ```
 */
export function autoValidate(schema: z.ZodSchema) {
  return (body: any, _user: any) => {
    const result = schema.safeParse(body)
    if (!result.success) throw new Error(result.error.issues[0].message)
    return result.data
  }
}
