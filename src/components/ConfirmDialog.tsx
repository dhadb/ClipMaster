import React, { memo } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import Modal from './ui/Modal'

const TITLE_ID = 'confirm-dialog-title'

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

const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal open={open} onClose={onCancel} labelledBy={TITLE_ID} maxWidth="24rem" zIndex={80} blur={12}>
      <div className="flex items-start gap-3 px-4 py-4">
        <div
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            color: danger ? 'var(--color-danger)' : 'var(--color-warning)',
            background: `color-mix(in srgb, ${danger ? 'var(--color-danger)' : 'var(--color-warning)'} 12%, transparent)`,
          }}
        >
          <AlertTriangle size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={TITLE_ID} className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="action-btn" title={cancelLabel} aria-label={cancelLabel}>
          <X size={14} />
        </button>
      </div>
      <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-divider)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-md px-3 text-[11px] interactive-chip"
          style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-8 rounded-md px-3 text-[11px] font-medium interactive-chip"
          style={{ color: 'white', background: danger ? 'var(--color-danger)' : 'var(--color-primary)' }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default memo(ConfirmDialog)
