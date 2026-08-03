// 原料厂家资料分类（fileType → 展示名）
// 列表页新增弹窗与详情页共用，保证两处分类一致
export const MATERIAL_DOC_TYPES: { type: string; label: string; hint: string }[] = [
  { type: 'MSDS', label: 'MSDS 安全数据表', hint: '物质安全数据表（GB/T 16483）' },
  { type: 'TDS', label: 'TDS 技术数据表', hint: '技术参数、性能指标' },
  { type: 'COA', label: 'COA 批次分析', hint: '批次分析证书' },
  { type: 'SAFETY_INFO', label: '原料安全信息', hint: '原料安全信息文件/报送码' },
  { type: 'SPEC', label: '规格书', hint: '纯度、含量、指标限值' },
  { type: 'TEST_REPORT', label: '第三方检测报告', hint: '重金属、微生物、农残等' },
  { type: 'INCI', label: 'INCI 证明', hint: 'INCI 名称证明/对照' },
  { type: 'OTHER', label: '其他资料', hint: '其他不确定类型的资料兜底' },
]
