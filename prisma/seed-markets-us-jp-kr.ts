import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface RegulationSeed {
  nameCn: string
  nameEn?: string
  casNo?: string
  regulationType: 'PROHIBITED' | 'RESTRICTED' | 'ALLOWED'
  market: 'US' | 'JP' | 'KR'
  maxConcentration?: number
  productTypeRestriction?: string
  restrictionNote?: string
  sourceRegulation: string
  category?: string
  ingredientFunction?: string
}

const usRegulations: RegulationSeed[] = [
  // ── FDA 21 CFR 700.11-35 禁用成分 ──
  { nameCn: '硫双二氯酚', nameEn: 'Bithionol', casNo: '97-18-7', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.11', category: 'FDA-禁用', ingredientFunction: '防腐剂' },
  { nameCn: '氯乙烯', nameEn: 'Vinyl chloride', casNo: '75-01-4', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.14', category: 'FDA-禁用-气雾剂', ingredientFunction: '推进剂' },
  { nameCn: '三溴沙仑', nameEn: 'Tribromsalan (TBS)', casNo: '87-10-5', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.15', category: 'FDA-禁用-卤代水杨酰苯胺', ingredientFunction: '抗菌剂' },
  { nameCn: '二溴沙仑', nameEn: 'Dibromsalan (DBS)', casNo: '87-12-7', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.15', category: 'FDA-禁用-卤代水杨酰苯胺', ingredientFunction: '抗菌剂' },
  { nameCn: '甲溴沙仑', nameEn: 'Metabromsalan (MBS)', casNo: '2577-72-2', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.15', category: 'FDA-禁用-卤代水杨酰苯胺', ingredientFunction: '抗菌剂' },
  { nameCn: '3,3′,4,5′-四氯水杨酰苯胺', nameEn: '3,3′,4,5′-Tetrachlorosalicylanilide', casNo: '1154-59-2', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.15', category: 'FDA-禁用-卤代水杨酰苯胺', ingredientFunction: '抗菌剂' },
  { nameCn: '氯仿', nameEn: 'Chloroform', casNo: '67-66-3', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.18', category: 'FDA-禁用', ingredientFunction: '溶剂' },
  { nameCn: '二氯甲烷', nameEn: 'Methylene chloride', casNo: '75-09-2', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.19', category: 'FDA-禁用', ingredientFunction: '溶剂' },
  { nameCn: '氯氟碳化合物', nameEn: 'Chlorofluorocarbon propellants', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.23', category: 'FDA-禁用-气雾剂', ingredientFunction: '推进剂' },
  { nameCn: '含锆化合物', nameEn: 'Zirconium-containing complexes', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: '21 CFR 700.16', category: 'FDA-禁用-气雾剂', ingredientFunction: '添加剂' },
  { nameCn: '甲基丙烯酸甲酯单体', nameEn: 'Methyl methacrylate monomer (MMA)', casNo: '80-62-6', regulationType: 'PROHIBITED', market: 'US', sourceRegulation: 'FDA FR Vol.39,1974', category: 'FDA-禁用-指甲', ingredientFunction: '指甲增强剂' },
  { nameCn: '六氯酚', nameEn: 'Hexachlorophene', casNo: '70-30-4', regulationType: 'RESTRICTED', market: 'US', maxConcentration: 0.1, sourceRegulation: '21 CFR 250.250', category: 'FDA-限用', ingredientFunction: '防腐剂' },
  { nameCn: '汞化合物', nameEn: 'Mercury compounds', regulationType: 'RESTRICTED', market: 'US', maxConcentration: 0.0065, productTypeRestriction: '仅限眼部', sourceRegulation: '21 CFR 700.13', category: 'FDA-限用', ingredientFunction: '防腐剂' },
]

const jpRegulations: RegulationSeed[] = [
  // ── 日本化粧品基準 别表第1（禁用30种）──
  { nameCn: '2-乙氧基乙醇', nameEn: '2-Ethoxyethanol', casNo: '110-80-5', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準(H12厚生省告示331号)别表1-1', category: 'JP-禁用', ingredientFunction: '溶剂' },
  { nameCn: '黄樟素', nameEn: 'Safrole', casNo: '94-59-7', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-3', category: 'JP-禁用', ingredientFunction: '香料' },
  { nameCn: '黄樟油', nameEn: 'Sassafras oil', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-2', category: 'JP-禁用', ingredientFunction: '香料' },
  { nameCn: '二甲基噁唑烷', nameEn: 'Dimethoxane', casNo: '828-00-2', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-4', category: 'JP-禁用', ingredientFunction: '防腐剂' },
  { nameCn: '氟代乙酰胺', nameEn: 'Fluoroacetamide', casNo: '640-19-7', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-6', category: 'JP-禁用', ingredientFunction: '灭鼠药成分' },
  { nameCn: '亚硝胺类', nameEn: 'N-Nitrosamines', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-7', category: 'JP-禁用', ingredientFunction: '致癌物' },
  { nameCn: '甲醛', nameEn: 'Formaldehyde', casNo: '50-00-0', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-8', category: 'JP-禁用', ingredientFunction: '防腐剂' },
  { nameCn: '多氯联苯', nameEn: 'Polychlorinated biphenyls (PCBs)', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-9', category: 'JP-禁用', ingredientFunction: '工业污染物' },
  { nameCn: '毛果芸香碱', nameEn: 'Pilocarpine', casNo: '92-13-7', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-10', category: 'JP-禁用', ingredientFunction: '生物碱' },
  { nameCn: '毒扁豆碱', nameEn: 'Physostigmine (Eserine)', casNo: '57-47-6', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-11', category: 'JP-禁用', ingredientFunction: '生物碱' },
  { nameCn: '阿托品', nameEn: 'Atropine', casNo: '51-55-8', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-12', category: 'JP-禁用', ingredientFunction: '生物碱' },
  { nameCn: '可卡因', nameEn: 'Cocaine', casNo: '50-36-2', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-13', category: 'JP-禁用', ingredientFunction: '麻醉药' },
  { nameCn: '铍及其化合物', nameEn: 'Beryllium compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-17', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '砷及其化合物', nameEn: 'Arsenic compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-18', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '铅及其化合物', nameEn: 'Lead compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-20', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '镉及其化合物', nameEn: 'Cadmium compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-22', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '锑及其化合物', nameEn: 'Antimony compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-24', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '硒及其化合物', nameEn: 'Selenium compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-25', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '碲及其化合物', nameEn: 'Tellurium compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-26', category: 'JP-禁用', ingredientFunction: '重金属' },
  { nameCn: '钍及其化合物', nameEn: 'Thorium compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-27', category: 'JP-禁用', ingredientFunction: '放射性物质' },
  { nameCn: '铀及其化合物', nameEn: 'Uranium compounds', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-28', category: 'JP-禁用', ingredientFunction: '放射性物质' },
  { nameCn: '氯乙烯', nameEn: 'Vinyl chloride', casNo: '75-01-4', regulationType: 'PROHIBITED', market: 'JP', sourceRegulation: '化粧品基準别表1-30', category: 'JP-禁用', ingredientFunction: '推进剂' },
  // ── 日本 别表第2 限用成分 ──
  { nameCn: '过氧化氢', nameEn: 'Hydrogen peroxide', casNo: '7722-84-1', regulationType: 'RESTRICTED', market: 'JP', maxConcentration: 6.0, sourceRegulation: '化粧品基準别表2', category: 'JP-限用', ingredientFunction: '氧化剂' },
  { nameCn: '间苯二酚', nameEn: 'Resorcinol', casNo: '108-46-3', regulationType: 'RESTRICTED', market: 'JP', maxConcentration: 5.0, sourceRegulation: '化粧品基準别表2', category: 'JP-限用', ingredientFunction: '防腐剂' },
  { nameCn: '水杨酸', nameEn: 'Salicylic acid', casNo: '69-72-7', regulationType: 'RESTRICTED', market: 'JP', maxConcentration: 2.0, sourceRegulation: '化粧品基準别表2', category: 'JP-限用', ingredientFunction: '防腐剂' },
  { nameCn: '对羟基苯甲酸酯类', nameEn: 'Parabens', regulationType: 'RESTRICTED', market: 'JP', maxConcentration: 1.0, sourceRegulation: '化粧品基準别表2', category: 'JP-限用', ingredientFunction: '防腐剂' },
  { nameCn: '苯氧乙醇', nameEn: 'Phenoxyethanol', casNo: '122-99-6', regulationType: 'ALLOWED', market: 'JP', maxConcentration: 1.0, sourceRegulation: '化粧品基準别表2', category: 'JP-准用防腐剂', ingredientFunction: '防腐剂' },
]

const krRegulations: RegulationSeed[] = [
  // ── 韩国 MFDS 禁用成分 ──
  { nameCn: '甲醛', nameEn: 'Formaldehyde', casNo: '50-00-0', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '防腐剂' },
  { nameCn: '氯仿', nameEn: 'Chloroform', casNo: '67-66-3', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '溶剂' },
  { nameCn: '六氯酚', nameEn: 'Hexachlorophene', casNo: '70-30-4', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '防腐剂' },
  { nameCn: '汞及其化合物', nameEn: 'Mercury compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '铅及其化合物', nameEn: 'Lead compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '镉及其化合物', nameEn: 'Cadmium compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '锑及其化合物', nameEn: 'Antimony compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '砷及其化合物', nameEn: 'Arsenic compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '铍及其化合物', nameEn: 'Beryllium compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '铊及其化合物', nameEn: 'Thallium compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '锶及其化合物（除 permitted外）', nameEn: 'Strontium compounds', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '铬酸及其盐', nameEn: 'Chromic acid and its salts', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '重金属' },
  { nameCn: '雌二醇', nameEn: '17β-Estradiol', casNo: '50-28-2', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用-激素', ingredientFunction: '激素' },
  { nameCn: '雌酮', nameEn: 'Estrone', casNo: '53-16-7', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用-激素', ingredientFunction: '激素' },
  { nameCn: '乙炔雌二醇', nameEn: 'Ethinylestradiol', casNo: '57-63-6', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用-激素', ingredientFunction: '激素' },
  { nameCn: '睾丸酮', nameEn: 'Testosterone', casNo: '58-22-0', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用-激素', ingredientFunction: '激素' },
  { nameCn: '黄体酮', nameEn: 'Progesterone', casNo: '57-83-0', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用-激素', ingredientFunction: '激素' },
  { nameCn: '2,4-二硝基苯酚', nameEn: '2,4-Dinitrophenol', casNo: '51-28-5', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '化学物质' },
  { nameCn: '4-羟基苯甲酸苄酯', nameEn: 'Benzyl 4-hydroxybenzoate', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '防腐剂' },
  { nameCn: '苯并[a]芘', nameEn: 'Benzo[a]pyrene', casNo: '50-32-8', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1', category: 'KR-禁用', ingredientFunction: '致癌物' },
  // ── 韩国 MFDS 限用/准用成分 ──
  { nameCn: '对羟基苯甲酸甲酯', nameEn: 'Methylparaben', casNo: '99-76-3', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 0.4, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用防腐剂', ingredientFunction: '防腐剂' },
  { nameCn: '对羟基苯甲酸乙酯', nameEn: 'Ethylparaben', casNo: '120-47-8', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 0.4, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用防腐剂', ingredientFunction: '防腐剂' },
  { nameCn: '对羟基苯甲酸丙酯', nameEn: 'Propylparaben', casNo: '94-13-3', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 0.4, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用防腐剂', ingredientFunction: '防腐剂' },
  { nameCn: '对羟基苯甲酸丁酯', nameEn: 'Butylparaben', casNo: '94-26-8', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 0.4, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用防腐剂', ingredientFunction: '防腐剂' },
  { nameCn: '苯氧乙醇', nameEn: 'Phenoxyethanol', casNo: '122-99-6', regulationType: 'ALLOWED', market: 'KR', maxConcentration: 1.0, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-准用防腐剂', ingredientFunction: '防腐剂' },
  { nameCn: '水杨酸', nameEn: 'Salicylic acid', casNo: '69-72-7', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 2.0, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用', ingredientFunction: '防腐剂' },
  { nameCn: '过氧化氢', nameEn: 'Hydrogen peroxide', casNo: '7722-84-1', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 6.0, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用', ingredientFunction: '氧化剂/漂白剂' },
  { nameCn: '二苯酮-3', nameEn: 'Benzophenone-3 (Oxybenzone)', casNo: '131-57-7', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 2.4, sourceRegulation: 'MFDS 2025-63号修订', category: 'KR-限用防晒剂', ingredientFunction: '防晒剂' },
  { nameCn: '甲氧基肉桂酸乙基己酯', nameEn: 'Ethylhexyl methoxycinnamate', casNo: '5466-77-3', regulationType: 'RESTRICTED', market: 'KR', maxConcentration: 10.0, sourceRegulation: 'MFDS化妆品法附表2', category: 'KR-限用防晒剂', ingredientFunction: '防晒剂' },
  { nameCn: '叔丁基对苯二酚', nameEn: 'TBHQ', casNo: '1948-33-0', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1(2024修正)', category: 'KR-禁用', ingredientFunction: '抗氧化剂' },
  { nameCn: '全氟辛酸', nameEn: 'PFOA', casNo: '335-67-1', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1(2024修正)', category: 'KR-禁用-PFAS', ingredientFunction: 'PFAS' },
  { nameCn: '全氟辛烷磺酸', nameEn: 'PFOS', casNo: '1763-23-1', regulationType: 'PROHIBITED', market: 'KR', sourceRegulation: 'MFDS化妆品法附表1(2024修正)', category: 'KR-禁用-PFAS', ingredientFunction: 'PFAS' },
]

async function main() {
  console.log('🌱 开始导入美国/日本/韩国法规数据...\n')

  const allRegulations = [...usRegulations, ...jpRegulations, ...krRegulations]
  const total = allRegulations.length

  let imported = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < allRegulations.length; i++) {
    const reg = allRegulations[i]
    try {
      await prisma.ingredientRegulation.upsert({
        where: { nameCn_market: { nameCn: reg.nameCn, market: reg.market } },
        update: {
          nameEn: reg.nameEn || null,
          casNo: reg.casNo || null,
          regulationType: reg.regulationType,
          maxConcentration: reg.maxConcentration ?? null,
          productTypeRestriction: reg.productTypeRestriction || null,
          restrictionNote: reg.restrictionNote || null,
          sourceRegulation: reg.sourceRegulation,
          category: reg.category || null,
          ingredientFunction: reg.ingredientFunction || null,
        },
        create: {
          nameCn: reg.nameCn,
          nameEn: reg.nameEn || null,
          casNo: reg.casNo || null,
          regulationType: reg.regulationType,
          market: reg.market,
          maxConcentration: reg.maxConcentration ?? null,
          productTypeRestriction: reg.productTypeRestriction || null,
          restrictionNote: reg.restrictionNote || null,
          sourceRegulation: reg.sourceRegulation,
          category: reg.category || null,
          ingredientFunction: reg.ingredientFunction || null,
        },
      })
      imported++
    } catch (e: any) {
      console.error(`   ❌ 失败: ${reg.nameCn} (${reg.market}): ${e.message}`)
      skipped++
    }

    if ((i + 1) % 20 === 0 || i === total - 1) {
      console.log(`   ${i + 1}/${total}`)
    }
  }

  // 统计
  const stats = await prisma.ingredientRegulation.groupBy({
    by: ['market'],
    _count: true,
  })
  console.log('\n📊 各市场法规总数:')
  for (const s of stats) {
    console.log(`   ${s.market}: ${s._count} 条`)
  }

  const finalCount = await prisma.ingredientRegulation.count()
  console.log(`\n🎉 完成！法规数据库总计: ${finalCount} 条`)
  console.log(`   新建: ${imported}, 更新: ${updated}, 跳过: ${skipped}`)
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
