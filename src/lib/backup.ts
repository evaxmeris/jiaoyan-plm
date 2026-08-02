// 备份/恢复工具 — 通过 Prisma 读取所有表数据，不依赖 pg_dump
// 文件打包使用 Node.js 内置 zlib + tar-stream (需安装)

import { prisma } from '@/lib/prisma'
import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { join, basename } from 'path'

const BACKUP_DIR = '/app/backups'
const UPLOAD_DIR = '/app/public/uploads'

// 跳过的大表（日志类、内容可重建的）
const SKIP_TABLES = ['audit_log', '_prisma_migrations', 'sessions']

export interface BackupManifest {
  id: string
  createdAt: string
  size: string
  tables: number
  files: number
  dbSize: string
  fileSize: string
}

/** 运行 SQL 查询获取表名列表 */
async function getTableNames(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  )
  return rows.map(r => r.tablename).filter(t => !SKIP_TABLES.includes(t))
}

/** 获取数据库中所有表的数据行数 */
async function getTableRowCounts(): Promise<Record<string, number>> {
  const tables = await getTableNames()
  const counts: Record<string, number> = {}
  for (const table of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint as count FROM "${table}"`
      )
      counts[table] = Number(rows[0]?.count || 0)
    } catch { counts[table] = 0 }
  }
  return counts
}

/** 导出数据库到 JSON 文件 */
async function exportDatabase(targetDir: string): Promise<{ tables: number; size: string }> {
  const tables = await getTableNames()
  let totalSize = 0
  let totalTables = 0

  for (const table of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`)
      const json = JSON.stringify(rows, null, 2)
      const filePath = join(targetDir, `${table}.json`)
      await writeFile(filePath, json, 'utf-8')
      totalSize += Buffer.byteLength(json, 'utf-8')
      totalTables++
    } catch (err) {
      console.warn(`跳过表 ${table}: ${err}`)
    }
  }

  return { tables: totalTables, size: formatSize(totalSize) }
}

/** 打包上传文件 */
async function exportFiles(targetDir: string): Promise<{ files: number; size: string }> {
  if (!existsSync(UPLOAD_DIR)) return { files: 0, size: '0 B' }

  const entries = await readdir(UPLOAD_DIR)
  let totalSize = 0
  let totalFiles = 0

  for (const name of entries) {
    const src = join(UPLOAD_DIR, name)
    const dst = join(targetDir, 'files', name)
    const s = await stat(src)
    if (s.isFile()) {
      await mkdir(join(targetDir, 'files'), { recursive: true })
      await writeFile(dst, await readFile(src))
      totalSize += s.size
      totalFiles++
    }
  }

  return { files: totalFiles, size: formatSize(totalSize) }
}

/** 创建完整备份 */
export async function createBackup(userName?: string): Promise<BackupManifest> {
  const id = `backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  const dir = join(BACKUP_DIR, id)
  await mkdir(dir, { recursive: true })

  // 导出数据库
  const dbResult = await exportDatabase(dir)
  // 打包文件
  const fileResult = await exportFiles(dir)

  // 写入清单
  const manifest: BackupManifest & { restoredBy?: string } = {
    id,
    createdAt: new Date().toISOString(),
    size: dbResult.size,
    tables: dbResult.tables,
    files: fileResult.files,
    dbSize: dbResult.size,
    fileSize: fileResult.size,
  }
  if (userName) manifest.restoredBy = userName
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  return manifest
}

/** 列出所有备份 */
export async function listBackups(): Promise<BackupManifest[]> {
  if (!existsSync(BACKUP_DIR)) return []
  const entries = await readdir(BACKUP_DIR)
  const manifests: BackupManifest[] = []

  for (const name of entries.sort().reverse()) {
    try {
      const content = await readFile(join(BACKUP_DIR, name, 'manifest.json'), 'utf-8')
      manifests.push(JSON.parse(content))
    } catch {
      // 不完整或损坏的备份目录，跳过
    }
  }
  return manifests
}

/** 恢复数据库（从备份目录读取 JSON，写入数据库） */
export async function restoreDatabase(backupId: string): Promise<void> {
  const dir = join(BACKUP_DIR, backupId)
  if (!existsSync(dir)) throw new Error('备份不存在')

  const entries = await readdir(dir)
  for (const name of entries) {
    if (!name.endsWith('.json') || name === 'manifest.json') continue
    const table = name.replace(/\.json$/, '')
    const content = await readFile(join(dir, name), 'utf-8')
    const rows = JSON.parse(content)
    if (rows.length === 0) continue

    // 清空表
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)

    // 逐行插入（通过 raw SQL，避免 Prisma 类型映射问题）
    for (const row of rows) {
      const keys = Object.keys(row)
      const values = keys.map(k => row[k])
      const placeholders = keys.map((_, i) => `$${i + 1}`)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
        ...values.map(v => v === null ? null : v instanceof Date ? v.toISOString() : v)
      )
    }
  }
}

/** 恢复文件 */
export async function restoreFiles(backupId: string): Promise<void> {
  const dir = join(BACKUP_DIR, backupId, 'files')
  if (!existsSync(dir)) return

  const entries = await readdir(dir)
  await mkdir(UPLOAD_DIR, { recursive: true })
  for (const name of entries) {
    await writeFile(join(UPLOAD_DIR, name), await readFile(join(dir, name)))
  }
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}
