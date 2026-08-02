import { describe, it, expect, vi } from 'vitest'
import { verifyPermission, verifyRoleHierarchy } from '@/lib/auth'

// ─── 模拟 Prisma ───
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userPermission: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-token'),
    verify: vi.fn((token: string) => {
      if (token === 'valid-token') {
        return { userId: 'u1', email: 'admin@test.com', role: 'CEO', name: 'Admin' }
      }
      throw new Error('Invalid token')
    }),
  },
  sign: vi.fn(() => 'mock-token'),
  verify: vi.fn((token: string) => {
    if (token === 'valid-token') {
      return { userId: 'u1', email: 'admin@test.com', role: 'CEO', name: 'Admin' }
    }
    throw new Error('Invalid token')
  }),
}))

// ─── 权限系统白盒测试 ───

// ─── 1. 权限矩阵测试 ───

describe('权限系统 - 角色权限矩阵', () => {

  describe('formula 操作', () => {
    it('CEO 可以执行所有 formula 操作', async () => {
      expect(await verifyPermission('CEO', 'formula.view')).toBe(true)
      expect(await verifyPermission('CEO', 'formula.create')).toBe(true)
      expect(await verifyPermission('CEO', 'formula.update')).toBe(true)
      expect(await verifyPermission('CEO', 'formula.delete')).toBe(true)
    })

    it('RND_MANAGER 可以执行所有 formula 操作', async () => {
      expect(await verifyPermission('RND_MANAGER', 'formula.view')).toBe(true)
      expect(await verifyPermission('RND_MANAGER', 'formula.create')).toBe(true)
      expect(await verifyPermission('RND_MANAGER', 'formula.delete')).toBe(true)
    })

    it('DEVELOPER 可以查看/创建/更新配方，但不能删除', async () => {
      expect(await verifyPermission('DEVELOPER', 'formula.view')).toBe(true)
      expect(await verifyPermission('DEVELOPER', 'formula.create')).toBe(true)
      expect(await verifyPermission('DEVELOPER', 'formula.update')).toBe(true)
      expect(await verifyPermission('DEVELOPER', 'formula.delete')).toBe(false)
    })

    it('PURCHASER 不能操作配方', async () => {
      expect(await verifyPermission('PURCHASER', 'formula.view')).toBe(false)
      expect(await verifyPermission('PURCHASER', 'formula.create')).toBe(false)
    })

    it('未定义的操作默认拒绝非 CEO', async () => {
      expect(await verifyPermission('DEVELOPER', 'unknown.op')).toBe(false)
      expect(await verifyPermission('FINANCE', 'unknown.op')).toBe(false)
    })
  })

  describe('purchase 操作', () => {
    it('CEO 可以执行所有采购操作', async () => {
      expect(await verifyPermission('CEO', 'purchase.view')).toBe(true)
      expect(await verifyPermission('CEO', 'purchase.create')).toBe(true)
      expect(await verifyPermission('CEO', 'purchase.approve')).toBe(true)
    })

    it('PURCHASER 可以查看和创建采购，但不能审批', async () => {
      expect(await verifyPermission('PURCHASER', 'purchase.view')).toBe(true)
      expect(await verifyPermission('PURCHASER', 'purchase.create')).toBe(true)
      expect(await verifyPermission('PURCHASER', 'purchase.approve')).toBe(false)
    })

    it('FINANCE 可以查看和审批采购，但不能创建', async () => {
      expect(await verifyPermission('FINANCE', 'purchase.view')).toBe(true)
      expect(await verifyPermission('FINANCE', 'purchase.approve')).toBe(true)
      expect(await verifyPermission('FINANCE', 'purchase.create')).toBe(false)
    })

    it('RND_MANAGER 可以查看和审批采购', async () => {
      expect(await verifyPermission('RND_MANAGER', 'purchase.view')).toBe(true)
      expect(await verifyPermission('RND_MANAGER', 'purchase.approve')).toBe(true)
    })
  })

  describe('敏感操作 — 仅 CEO', () => {
    const ceoOnlyOps = [
      'trade_secret.create', 'trade_secret.view',
      'audit_log.view', 'settings.backup',
      'user.create', 'user.update',
    ]

    ceoOnlyOps.forEach(op => {
      it(`${op} 仅 CEO 可执行`, async () => {
        expect(await verifyPermission('CEO', op)).toBe(true)
        expect(await verifyPermission('RND_MANAGER', op)).toBe(false)
        expect(await verifyPermission('FINANCE', op)).toBe(false)
        expect(await verifyPermission('DEVELOPER', op)).toBe(false)
      })
    })
  })

  describe('material.view — 多角色可访问', () => {
    it('研发、采购、生产角色的都可以查看原料', async () => {
      expect(await verifyPermission('RND_MANAGER', 'material.view')).toBe(true)
      expect(await verifyPermission('DEVELOPER', 'material.view')).toBe(true)
      expect(await verifyPermission('PURCHASER', 'material.view')).toBe(true)
      expect(await verifyPermission('PRODUCTION', 'material.view')).toBe(true)
    })

    it('财务和合规角色不能查看原料', async () => {
      expect(await verifyPermission('FINANCE', 'material.view')).toBe(false)
      expect(await verifyPermission('COMPLIANCE', 'material.view')).toBe(false)
    })
  })
})

// ─── 2. 角色层级测试 ───

describe('权限系统 - 角色层级', () => {
  it('CEO 满足所有层级要求', () => {
    expect(verifyRoleHierarchy('CEO', 'OBSERVER')).toBe(true)
    expect(verifyRoleHierarchy('CEO', 'FINANCE')).toBe(true)
    expect(verifyRoleHierarchy('CEO', 'CEO')).toBe(true)
  })

  it('DEVELOPER 不能执行 FINANCE 或以上的操作', () => {
    expect(verifyRoleHierarchy('DEVELOPER', 'FINANCE')).toBe(false)
    expect(verifyRoleHierarchy('DEVELOPER', 'CEO')).toBe(false)
  })

  it('RND_MANAGER 层级高于 DEVELOPER', () => {
    expect(verifyRoleHierarchy('RND_MANAGER', 'DEVELOPER')).toBe(true)
    expect(verifyRoleHierarchy('DEVELOPER', 'RND_MANAGER')).toBe(false)
  })

  it('OBSERVER 是最低层级', () => {
    expect(verifyRoleHierarchy('OBSERVER', 'DEVELOPER')).toBe(false)
    expect(verifyRoleHierarchy('OBSERVER', 'OBSERVER')).toBe(true)
  })

  it('未知角色默认最低', () => {
    expect(verifyRoleHierarchy('UNKNOWN', 'OBSERVER')).toBe(false)
  })

  it('未知最小角色要求默认最高（仅 CEO 可通过）', () => {
    expect(verifyRoleHierarchy('CEO', 'UNKNOWN_ROLE')).toBe(true)
    expect(verifyRoleHierarchy('DEVELOPER', 'UNKNOWN_ROLE')).toBe(false)
  })
})

// ─── 3. Zod 校验 Schema 测试 ───

describe('校验 Schema - LoginSchema', () => {
  it('有效邮箱和密码通过校验', async () => {
    const { LoginSchema } = await import('@/lib/validation')
    const result = LoginSchema.safeParse({ email: 'test@test.com', password: '123456' })
    expect(result.success).toBe(true)
  })

  it('无效邮箱拒绝', async () => {
    const { LoginSchema } = await import('@/lib/validation')
    const result = LoginSchema.safeParse({ email: 'not-an-email', password: '123456' })
    expect(result.success).toBe(false)
  })

  it('短密码拒绝', async () => {
    const { LoginSchema } = await import('@/lib/validation')
    const result = LoginSchema.safeParse({ email: 'test@test.com', password: '123' })
    expect(result.success).toBe(false)
  })

  it('空值拒绝', async () => {
    const { LoginSchema } = await import('@/lib/validation')
    const result = LoginSchema.safeParse({ email: '', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('校验 Schema - PurchaseApplicationSchema', () => {
  it('完整有效的采购申请通过校验', async () => {
    const { PurchaseApplicationSchema } = await import('@/lib/validation')
    const result = PurchaseApplicationSchema.safeParse({
      title: '采购实验耗材',
      category: 'LAB_SUPPLIES',
      totalAmount: 5000,
      urgency: 'NORMAL',
      purpose: '实验室日常使用',
      items: [
        { name: '试管', quantity: 100, unit: '支', estimatedPrice: 5 },
        { name: '烧杯', quantity: 20, unit: '个', estimatedPrice: 15 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('空标题拒绝', async () => {
    const { PurchaseApplicationSchema } = await import('@/lib/validation')
    const result = PurchaseApplicationSchema.safeParse({
      title: '',
      totalAmount: 100,
      purpose: '测试',
      items: [{ name: '物品', quantity: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('负金额拒绝', async () => {
    const { PurchaseApplicationSchema } = await import('@/lib/validation')
    const result = PurchaseApplicationSchema.safeParse({
      title: '采购',
      totalAmount: -100,
      purpose: '测试',
      items: [{ name: '物品', quantity: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('空采购项列表拒绝', async () => {
    const { PurchaseApplicationSchema } = await import('@/lib/validation')
    const result = PurchaseApplicationSchema.safeParse({
      title: '采购',
      totalAmount: 0,
      purpose: '测试',
      items: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('校验 Schema - BudgetSchema', () => {
  it('有效预算通过校验', async () => {
    const { BudgetSchema } = await import('@/lib/validation')
    const result = BudgetSchema.safeParse({
      department: '研发部',
      fiscalYear: 2026,
      totalAmount: 1000000,
    })
    expect(result.success).toBe(true)
  })

  it('负预算拒绝', async () => {
    const { BudgetSchema } = await import('@/lib/validation')
    const result = BudgetSchema.safeParse({
      department: '研发部',
      fiscalYear: 2026,
      totalAmount: -1,
    })
    expect(result.success).toBe(false)
  })

  it('无效年份拒绝', async () => {
    const { BudgetSchema } = await import('@/lib/validation')
    const result = BudgetSchema.safeParse({
      department: '研发部',
      fiscalYear: 2019,
      totalAmount: 1000,
    })
    expect(result.success).toBe(false)
  })
})

describe('校验 Schema - TrademarkSchema', () => {
  it('有效商标通过校验', async () => {
    const { TrademarkSchema } = await import('@/lib/validation')
    const result = TrademarkSchema.safeParse({
      name: '靘靓',
      type: 'WORD',
      category: '第3类',
      owner: '交研生物',
    })
    expect(result.success).toBe(true)
  })

  it('空名称拒绝', async () => {
    const { TrademarkSchema } = await import('@/lib/validation')
    const result = TrademarkSchema.safeParse({
      name: '',
      type: 'WORD',
      category: '第3类',
      owner: '交研生物',
    })
    expect(result.success).toBe(false)
  })
})
