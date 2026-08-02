import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

/**
 * 配方更新后自动计算原料成本并创建 ProductCosting 记录。
 * 不抛出异常，所有错误仅 console.error，不影响主流程。
 */
export async function autoCalculateCosting(
  formulaId: string,
  user: { id: string; name: string },
): Promise<void> {
  try {
    // 查找关联此配方的所有产品
    const products = await prisma.productDesign.findMany({
      where: { formulaId, isDeleted: false },
      select: { id: true },
    })

    if (products.length === 0) return

    // 读取配方成分 + 原料价格
    const formula = await prisma.formula.findUnique({
      where: { id: formulaId },
      include: {
        items: {
          include: {
            rawMaterial: { select: { latestPrice: true } },
          },
        },
      },
    })

    if (!formula || formula.items.length === 0) return

    // 计算 unitCost = Σ(percentage/100 × latestPrice)
    let hasMissingPrice = false
    const unitCost = formula.items.reduce((sum, item) => {
      const price = item.rawMaterial.latestPrice
      if (price === null || price === undefined) {
        hasMissingPrice = true
        return sum // contribution = 0
      }
      return sum + (item.percentage / 100) * price
    }, 0)

    if (hasMissingPrice) {
      console.warn(
        `[AutoCosting] 配方 ${formulaId} 有原料未设置 latestPrice，rawMaterialCost 已置 0`,
      )
    }

    const roundedCost = Math.round(unitCost * 100) / 100

    for (const product of products) {
      // 查找该产品的最新核算版本号
      const latestCosting = await prisma.productCosting.findFirst({
        where: { productDesignId: product.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      const nextVersion = (latestCosting?.version ?? 0) + 1

      await prisma.productCosting.create({
        data: {
          productDesignId: product.id,
          version: nextVersion,
          costingDate: new Date(),
          // rawMaterialCost 存配方级单位原料成本
          rawMaterialCost: hasMissingPrice ? 0 : roundedCost,
          // 其余成本项保持默认 0，totalCost 即等于 rawMaterialCost
          totalCost: hasMissingPrice ? 0 : roundedCost,
          unitCost: hasMissingPrice ? 0 : roundedCost,
          status: 'DRAFT',
          remark: `配方更新自动核算 (v${nextVersion})`,
        },
      })

      // 写入审计日志
      await writeAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'COSTING_AUTO_CALC',
        entity: 'ProductCosting',
        entityId: product.id,
        detail: {
          formulaId,
          productId: product.id,
          version: nextVersion,
          unitCost: roundedCost,
          hasMissingPrice,
        },
      })
    }
  } catch (error) {
    console.error('[AutoCosting] 自动核算失败:', error)
  }
}
