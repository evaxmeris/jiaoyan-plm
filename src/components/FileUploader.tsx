'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { Upload, Trash2, FileText, Download, RefreshCw, Eye } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

// 文件类型标签映射
const FILE_TYPE_LABELS: Record<string, string> = {
  COA: 'COA 分析报告',
  MSDS: 'MSDS 安全数据表',
  TDS: 'TDS 技术数据表',
  SAFETY_INFO: '原料安全信息',
  SPEC: '规格书',
  TEST_REPORT: '第三方检测报告',
  INCI: 'INCI 证明',
  LICENSE: '许可证',
  NDA: '保密协议',
  REPORT: '报告',
  CERT: '认证证书',
  LABEL: '标签设计',
  PACKAGING: '包装设计',
  DESIGN: '设计文件',
  CONTRACT: '合同',
  INVOICE: '发票',
  OTHER: '其他资料',
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
  /** 上传时自动写入的 fileType（可选），与 fileTypeFilter 配套使用 */
  uploadFileType?: string
  /** 上传完成回调 */
  onUploadComplete?: (file: FileRecord) => void
  /** 删除完成回调 */
  onDeleteComplete?: (fileId: string) => void
  /** 紧凑模式：仅显示文件名称+图标+操作，上传区为单行按钮。适合嵌入详情页多个实例的场景 */
  compact?: boolean
  /** 隐藏"附件文件"标题栏（外部自行提供标题行与上传/刷新入口时使用） */
  hideHeader?: boolean
}

/** 命令式句柄：供外部标题行调用上传/刷新 */
export interface FileUploaderHandle {
  refresh: () => void
  triggerUpload: () => void
}

/**
 * 通用文件上传组件
 * - 显示已上传文件列表
 * - 支持文件上传（拖拽/点击）
 * - 支持文件删除
 * - 支持文件预览/下载
 */
const FileUploader = forwardRef<FileUploaderHandle, FileUploaderProps>(function FileUploader(
  {
    entityType,
    entityId,
    allowUpload = true,
    allowDelete = true,
    fileTypeFilter,
    uploadFileType,
    onUploadComplete,
    onDeleteComplete,
    compact = false,
    hideHeader = false,
  },
  ref,
) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 获取文件列表
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ entityType, entityId })
      if (fileTypeFilter) params.set('fileType', fileTypeFilter)

      const res = await apiFetch(`/api/files?${params}`)
      if (!res.ok) throw new Error('获取文件列表失败')

      const json = await res.json()
      // 兼容 {success,data:{files}} 标准格式与旧顶层格式
      const list = json.files || json.data?.files || json.data?.data || []
      setFiles(Array.isArray(list) ? list : [])
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
      if (uploadFileType) formData.append('fileType', uploadFileType)

      const res = await apiFetch('/api/files', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '上传失败')
      }

      const data = await res.json()
      // 兼容 {success,data:{file}} 标准格式与旧顶层格式
      const uploaded = data.file || data.data?.file || data.data
      if (uploaded) {
        setFiles((prev) => [uploaded, ...prev])
        onUploadComplete?.(uploaded)
      } else {
        setError('上传成功但未返回文件信息')
      }
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
      const res = await apiFetch(`/api/files?id=${fileId}`, { method: 'DELETE' })
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

  // 输入框唯一 id（同页多个实例时避免冲突）
  const inputId = `file-input-${entityType}-${fileTypeFilter || uploadFileType || 'all'}`

  // 暴露命令式方法给外部标题行（上传/刷新）
  useImperativeHandle(ref, () => ({
    refresh: fetchFiles,
    triggerUpload: () => inputRef.current?.click(),
  }), [fetchFiles])

  if (!entityType || !entityId) {
    return (
      <div className="text-sm text-gray-400 p-4 text-center">
        请先保存实体后再上传文件
      </div>
    )
  }

  return (
    <div
      className="border border-gray-200 rounded-lg bg-white"
      onDragOver={hideHeader ? handleDragOver : undefined}
      onDragLeave={hideHeader ? handleDragLeave : undefined}
      onDrop={hideHeader ? handleDrop : undefined}
    >
      {/* 标题栏 */}
      {!hideHeader && (
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg ${compact ? 'select-none' : ''}`}
          onDragOver={compact ? handleDragOver : undefined}
          onDragLeave={compact ? handleDragLeave : undefined}
          onDrop={compact ? handleDrop : undefined}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">附件文件</span>
            {files.length > 0 && (
              <span className="text-xs text-gray-400">({files.length})</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {compact && allowUpload && (
              <button
                type="button"
                title="上传文件（可拖拽到此处）"
                onClick={() => document.getElementById(inputId)?.click()}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={fetchFiles}
              title="刷新"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 上传区域 */}
      {allowUpload && (
        compact ? (
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        ) : (
          <div
            className={`mx-4 mt-3 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById(inputId)?.click()}
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
              id={inputId}
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>
        )
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
              <li key={file.id} className={compact ? 'py-1.5 flex items-center gap-2' : 'py-3 flex items-start gap-3'}>
                {/* 文件图标 / 缩略图 */}
                <div className={`flex-shrink-0 rounded bg-gray-100 flex items-center justify-center overflow-hidden ${compact ? 'w-7 h-7 text-sm' : 'w-10 h-10 text-lg'}`}>
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
                  <div className={`${compact ? 'flex items-center justify-between gap-2' : 'flex items-start justify-between gap-2'}`}>
                    <div className={`${compact ? 'flex items-center gap-2 min-w-0' : 'min-w-0'}`}>
                      <p className={`font-medium text-gray-800 truncate ${compact ? 'text-sm' : 'text-sm'}`}>
                        {file.originalName}
                      </p>
                      <div className={compact ? 'flex items-center gap-1.5 flex-shrink-0' : 'flex items-center gap-2 mt-0.5'}>
                        <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                        {!compact && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{formatDate(file.createdAt)}</span>
                            {file.uploadedBy && (
                              <>
                                <span className="text-xs text-gray-300">·</span>
                                <span className="text-xs text-gray-400">{file.uploadedBy}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      {!compact && file.fileType && FILE_TYPE_LABELS[file.fileType] && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                          {FILE_TYPE_LABELS[file.fileType]}
                        </span>
                      )}
                      {!compact && file.remark && (
                        <p className="text-xs text-gray-500 mt-1">{file.remark}</p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={`/api/files/download/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                        title="在新页面打开查看"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <a
                        href={`/api/files/download/${file.id}`}
                        download
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                        title="下载另存"
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
})

export default FileUploader
