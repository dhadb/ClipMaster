import React, { memo } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog: React.FC<Props> = ({ open, title, description, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel }) => {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center p-4 detail-backdrop" style={{ background: 'color-mix(in srgb, var(--bg-root) 76%, transparent)', backdropFilter: 'blur(12px)' }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm overflow-hidden rounded-lg detail-panel" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-app)' }}>
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ color: danger ? 'var(--color-danger)' : 'var(--color-warning)', background: `color-mix(in srgb, ${danger ? 'var(--color-danger)' : 'var(--color-warning)'} 12%, transparent)` }}>
            <AlertTriangle size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
          </div>
          <button onClick={onCancel} className="action-btn" title={cancelLabel}><X size={14} /></button>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-divider)' }}>
          <button onClick={onCancel} className="h-8 rounded-md px-3 text-[11px] interactive-chip" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>{cancelLabel}</button>
          <button onClick={onConfirm} className="h-8 rounded-md px-3 text-[11px] font-medium interactive-chip" style={{ color: 'white', background: danger ? 'var(--color-danger)' : 'var(--color-primary)' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default memo(ConfirmDialog)
