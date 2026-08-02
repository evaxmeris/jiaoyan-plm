import { PrismaClient, Role, SupplierType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 填充种子数据...')

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD
  if (!defaultPassword) {
    console.error('❌ 请设置 SEED_DEFAULT_PASSWORD 环境变量（种子账号的默认登录密码）')
    process.exit(1)
  }
  const passwordHash = await bcrypt.hash(defaultPassword, 10)

  // 管理员账号（ACTIVE 状态 + isActive=true）
  await prisma.user.upsert({ where: { email: 'yingliang@jiaoyanbio.com' }, update: {}, create: { email: 'yingliang@jiaoyanbio.com', passwordHash, name: '应亮', role: Role.CEO, department: '总经办', status: 'ACTIVE' as any, isActive: true } })
  await prisma.user.upsert({ where: { email: 'admin@jiaoyan-bio.com' }, update: {}, create: { email: 'admin@jiaoyan-bio.com', passwordHash, name: '超级管理员', role: Role.CEO, department: '总经办', status: 'ACTIVE' as any, isActive: true } })
  await prisma.user.upsert({ where: { email: 'dev@jiaoyan-bio.com' }, update: {}, create: { email: 'dev@jiaoyan-bio.com', passwordHash, name: '研发工程师', role: Role.DEVELOPER, department: '研发部', status: 'ACTIVE' as any, isActive: true } })
  await prisma.user.upsert({ where: { email: 'compliance@jiaoyan-bio.com' }, update: {}, create: { email: 'compliance@jiaoyan-bio.com', passwordHash, name: '合规专员', role: Role.COMPLIANCE, department: '合规部', status: 'ACTIVE' as any, isActive: true } })
  console.log(`✅ 账号: yingliang@jiaoyanbio.com / admin@jiaoyan-bio.com / dev@jiaoyan-bio.com / compliance@jiaoyan-bio.com`)

  // 原料（nameCn 是 String，但没有 unique，用 findFirst + create 避免重复）
  const existingNames = new Set((await prisma.rawMaterial.findMany({ select: { nameCn: true } })).map(r => r.nameCn))
  const materials = [
    { nameCn: 'S²R 双酶复配粉', nameEn: 'S²R Dual Enzyme Complex', casNo: 'S2R-001', function: '活性物' },
    { nameCn: '甘油', nameEn: 'Glycerin', casNo: '56-81-5', function: '保湿剂' },
    { nameCn: '透明质酸钠', nameEn: 'Sodium Hyaluronate', casNo: '9067-32-7', function: '保湿剂' },
    { nameCn: '去离子水', nameEn: 'Deionized Water', casNo: '7732-18-5', function: '溶剂' },
    { nameCn: '丁二醇', nameEn: 'Butylene Glycol', casNo: '107-88-0', function: '保湿剂' },
    { nameCn: '角鲨烷', nameEn: 'Squalane', casNo: '111-01-3', function: '润肤剂' },
    { nameCn: '维生素E', nameEn: 'Tocopherol', casNo: '10191-41-0', function: '抗氧化剂' },
    { nameCn: '黄原胶', nameEn: 'Xanthan Gum', casNo: '11138-66-2', function: '增稠剂' },
    { nameCn: '苯氧乙醇', nameEn: 'Phenoxyethanol', casNo: '122-99-6', function: '防腐剂' },
  ]
  for (const m of materials) {
    if (!existingNames.has(m.nameCn)) {
      await prisma.rawMaterial.create({ data: { ...m, unit: 'kg' } })
    }
  }
  console.log(`✅ 原料: ${materials.length} 种`)

  // 供应商（同样避免重复）
  const existingSuppliers = new Set((await prisma.supplier.findMany({ select: { name: true } })).map(s => s.name))
  const suppliers = [
    { name: '西安交通大学实验室', type: SupplierType.RAW_MATERIAL, contact: '金教授' },
    { name: '广州白云代工厂', type: SupplierType.OEM, contact: '张经理', phone: '020-88888888' },
    { name: 'SGS 检测中心', type: SupplierType.TESTING, contact: '李工', phone: '400-888-8888' },
  ]
  for (const s of suppliers) {
    if (!existingSuppliers.has(s.name)) {
      await prisma.supplier.create({ data: s })
    }
  }
  console.log(`✅ 供应商: ${suppliers.length} 个`)

  console.log('🎉 种子数据填充完毕！')
}

main().catch(console.error).finally(() => prisma.$disconnect())
