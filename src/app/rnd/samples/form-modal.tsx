'use client'

export default function FormModal({
  open, title, onClose, onSave, saveLabel, children,
}: {
  open: boolean
  title: string
  onClose: () => void
  onSave: () => void
  saveLabel?: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[var(--color-card)] rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
          {children}
        </div>
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">取消</button>
          <button onClick={onSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors">
            {saveLabel || '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
