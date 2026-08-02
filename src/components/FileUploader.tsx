'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Trash2, FileText, Download, RefreshCw } from 'lucide-react'

// 文件类型标签映射
const FILE_TYPE_LABELS: Record<string, string> = {
  COA: 'COA 分析报告',
  MSDS: 'MSDS 安全数据表',
  TDS: 'TDS 技术数据表',
  LICENSE: '许可证',
  NDA: '保密协议',
  REPORT: '报告',
  CERT: '认证证书',
  LABEL: '标签设计',
  PACKAGING: '包装设计',
  DESIGN: '设计文件',
  CONTRACT: '合同',
  INVOICE: '发票',
  OTHER: '其他',
}

interface FileRecord {
  id: string
  name: string
  originalName: string
  url: string
  mimeType: string
  size: number
  entityType: string
  entityId: string
  fileType: string | null
  expireDate: string | null
  uploadedBy: string | null
  remark: string | null
  createdAt: string
}

interface FileUploaderProps {
  /** 实体类型，如 'Trademark', 'Patent', 'Registration' 等 */
  entityType: string
  /** 实体 ID */
  entityId: string
  /** 是否允许上传 */
  allowUpload?: boolean
  /** 是否允许删除 */
  allowDelete?: boolean
  /** 文件类型筛选（可选），如只显示 COA 文件 */
  fileTypeFilter?: string
  /** 上传完成回调 */
  onUploadComplete?: (file: FileRecord) => void
  /** 删除完成回调 */
  onDeleteComplete?: (fileId: string) => void
}

/**
 * 通用文件上传组件
 * - 显示已上传文件列表
 * - 支持文件上传（拖拽/点击）
 * - 支持文件删除
 * - 支持文件预览/下载
 */
export default function FileUploader({
  entityType,
  entityId,
  allowUpload = true,
  allowDelete = true,
  fileTypeFilter,
  onUploadComplete,
  onDeleteComplete,
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // 获取文件列表
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ entityType, entityId })
      if (fileTypeFilter) params.set('fileType', fileTypeFilter)

      const res = await fetch(`/api/files?${params}`)
      if (!res.ok) throw new Error('获取文件列表失败')

      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取文件列表失败')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, fileTypeFilter])

  useEffect(() => {
    if (entityType && entityId) {
      fetchFiles()
    }
  }, [entityType, entityId, fetchFiles])

  // 上传文件
  const handleUpload = async (file: File) => {
    if (!allowUpload) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', entityType)
      formData.append('entityId', entityId)

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '上传失败')
      }

      const data = await res.json()
      setFiles((prev) => [data.file, ...prev])
      onUploadComplete?.(data.file)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  // 删除文件
  const handleDelete = async (fileId: string) => {
    if (!allowDelete) return
    if (!confirm('确定要删除此文件吗？')) return

    try {
      setError(null)
      const res = await fetch(`/api/files?id=${fileId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '删除失败')
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId))
      onDeleteComplete?.(fileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
      e.target.value = '' // 重置 input 以便重新选择同一文件
    }
  }

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 格式化日期
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 获取文件类型图标
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
    return '📎'
  }

  // 判断是否为图片（可预览）
  const isImage = (mimeType: string) => mimeType.startsWith('image/')

  if (!entityType || !entityId) {
    return (
      <div className="text-sm text-gray-400 p-4 text-center">
        请先保存实体后再上传文件
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">附件文件</span>
          {files.length > 0 && (
            <span className="text-xs text-gray-400">({files.length})</span>
          )}
        </div>
        <button
          onClick={fetchFiles}
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 上传区域 */}
      {allowUpload && (
        <div
          className={`mx-4 mt-3 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
            ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-input-${entityType}`)?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span className="text-sm text-gray-500">上传中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-gray-400" />
              <p className="text-sm text-gray-500">
                点击或拖拽文件到此处上传
              </p>
              <p className="text-xs text-gray-400">
                支持 PDF、图片、Word、Excel 等格式，最大 20MB
              </p>
            </div>
          )}
          <input
            id={`file-input-${entityType}`}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </div>
      )}

      {/* 文件列表 */}
      <div className="px-4 pb-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">暂无文件</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {files.map((file) => (
              <li key={file.id} className="py-3 flex items-start gap-3">
                {/* 文件图标 / 缩略图 */}
                <div className="flex-shrink-0 w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-lg overflow-hidden">
                  {isImage(file.mimeType) ? (
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getFileIcon(file.mimeType)}</span>
                  )}
                </div>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {file.originalName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{formatDate(file.createdAt)}</span>
                        {file.uploadedBy && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{file.uploadedBy}</span>
                          </>
                        )}
                      </div>
                      {file.fileType && FILE_TYPE_LABELS[file.fileType] && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                          {FILE_TYPE_LABELS[file.fileType]}
                        </span>
                      )}
                      {file.remark && (
                        <p className="text-xs text-gray-500 mt-1">{file.remark}</p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                        title="下载/预览"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {allowDelete && (
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
