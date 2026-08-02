import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/settings/approval-flow — 获取所有审批流程、用户列表
export async function GET() {
  try {
    const user = await verifyAuth()
    if (!user) return errorResponse('未登录', 401)
    if (!await verifyPermission(user.role, 'approval_flow.view', user.id)) {
      return errorResponse('权限不足', 403)
    }

    // 获取所有流程
    const flows = await prisma.approvalFlow.findMany({
      orderBy: [{ module: 'asc' }, { updatedAt: 'desc' }],
    })

    // 获取所有活跃用户（供选择具体审批人）
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })

    // 按 module 分组返回
    const flowsByModule: Record<string, any[]> = {}
    for (const flow of flows) {
      const m = flow.module || 'purchase'
      if (!flowsByModule[m]) flowsByModule[m] = []
      flowsByModule[m].push(flow)
    }

    return NextResponse.json(successResponse({ flows, flowsByModule, users }))
  } catch (error) {
    console.error('获取审批流程失败:', error)
    return errorResponse('获取审批流程失败', 500)
  }
}

// POST /api/settings/approval-flow — 创建/更新审批流程（upsert）
export async function POST(req: NextRequest) {
  const user = await verifyAuth()
  if (!user) return errorResponse('未登录', 401)
  if (!await verifyPermission(user.role, 'approval_flow.update', user.id)) {
    return errorResponse('权限不足', 403)
  }
  if (user.role !== 'CEO') return errorResponse('仅 CEO 可配置审批流程', 403)

  try {
    const body = await req.json()
    const { name, stages, module: flowModule } = body

    if (!name || !stages || !Array.isArray(stages) || stages.length === 0) {
      return errorResponse('请提供流程名称和至少一个审批阶段', 400)
    }

    const targetModule = flowModule || 'purchase'

    // 验证 stages 结构
    for (const stage of stages) {
      if (!stage.level || !stage.label) {
        return errorResponse('每个阶段必须包含 level 和 label', 400)
      }
      // role 和 approverId 至少有一个
      if (!stage.role && !stage.approverId) {
        return errorResponse('每个阶段必须指定审批角色或具体审批人', 400)
      }
    }

    // 查找现有流程（同一 module 的所有流程都取消激活）
    const existingFlows = await prisma.approvalFlow.findMany({
      where: { module: targetModule, isActive: true },
    })

    // 把所有同 module 的流程标记为非激活
    for (const ef of existingFlows) {
      await prisma.approvalFlow.update({
        where: { id: ef.id },
        data: { isActive: false },
      })
    }

    // 新流程设为激活
    const flow = await prisma.approvalFlow.create({
      data: {
        name,
        module: targetModule,
        stages: stages,
        isActive: true,
      },
    })

    return NextResponse.json(successResponse({ flow }))
  } catch (error) {
    console.error('保存审批流程失败:', error)
    return errorResponse('保存审批流程失败', 500)
  }
}
