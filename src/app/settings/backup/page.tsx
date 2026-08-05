'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { apiFetch, isUnauthorizedError } from '@/lib/api-client'

interface Backup {
  id: string
  createdAt: string
  tables: number
  files: number
  dbSize: string
  fileSize: string
}

export default function BackupPage() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/settings/backup')
      const data = await res.json()
      setBackups(data.data?.backups || data.backups || [])
    } catch {
      showToast('error', '加载备份列表失败')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => { fetchBackups().catch(() => {}) }, [fetchBackups])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await apiFetch('/api/settings/backup', { method: 'POST' })
      const data = await res.json()
      if (data.data || data.success) {
        showToast('success', '备份创建成功')
        fetchBackups()
      } else {
        showToast('error', data.error || '备份失败')
      }
    } catch {
      showToast('error', '备份失败')
    }
    setCreating(false)
  }

  const handleDownload = (id: string) => {
    const a = document.createElement('a')
    a.href = `/api/settings/backup/${id}`
    a.download = `${id}.tar.gz`
    a.click()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`确定要删除备份 ${id} 吗？`)) return
    try {
      const res = await apiFetch(`/api/settings/backup/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('success', '备份已删除')
        fetchBackups()
      } else {
        showToast('error', '删除失败')
      }
    } catch {
      showToast('error', '删除失败')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-card)] border-b sticky top-16 z-10 shadow-sm">
        <div className="w-full mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/settings')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">&larr; 返回</button>
            <h1 className="text-xl font-bold text-[var(--color-text)]">数据备份</h1>
          </div>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50">
            {creating ? '备份中...' : '+ 创建备份'}
          </button>
        </div>
      </header>

      <main className="w-full mx-auto px-4 md:px-6 py-6 fade-in">
        <div className="bg-[var(--color-card)] rounded-xl border p-6 mb-6">
          <h2 className="text-base font-semibold mb-2">备份说明</h2>
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
            <li>• 数据库备份：通过 Prisma 读取所有业务表数据，导出为 JSON</li>
            <li>• 文件备份：备份上传的合同、报告等附件文件</li>
            <li>• 备份文件存储在 Docker 持久化卷中，重建容器不会丢失</li>
            <li>• 迁移时下载 tar.gz 文件，在新系统解压后放到 backups 目录即可恢复</li>
          </ul>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>
        ) : backups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">暂无备份</div>
            <div className="empty-state-desc">点击右上角"创建备份"开始</div>
          </div>
        ) : (
          <div className="bg-[var(--color-card)] rounded-xl border overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-[var(--color-bg)] border-b">
                  <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">备份时间</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">数据表</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">数据大小</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">附件文件</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">附件大小</th>
                  <th className="text-right px-4 py-3 text-[var(--color-text-secondary)] font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 font-medium text-xs whitespace-nowrap">{new Date(b.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{b.tables} 张</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-secondary)] whitespace-nowrap">{b.dbSize}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{b.files} 个</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-secondary)] whitespace-nowrap">{b.fileSize}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleDownload(b.id)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">下载</button>
                        <button onClick={() => handleDelete(b.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
