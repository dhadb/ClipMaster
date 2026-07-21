import React, { useEffect } from 'react'
import { Check, Info, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const ToastCenter: React.FC = () => {
  const toast = useClipboardStore(s => s.toast)
  const dismissToast = useClipboardStore(s => s.dismissToast)
  const restoreLastDeleted = useClipboardStore(s => s.restoreLastDeleted)
  const { t } = useI18n()

  useEffect(() => {
    if (!toast) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismissToast() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissToast, toast])

  if (!toast) return null
  const Icon = toast.tone === 'success' ? Check : toast.tone === 'warning' ? ShieldAlert : toast.tone === 'danger' ? ShieldAlert : Info
  const color = toast.tone === 'success' ? 'var(--color-success)' : toast.tone === 'warning' ? 'var(--color-warning)' : toast.tone === 'danger' ? 'var(--color-danger)' : 'var(--color-primary-light)'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 z-[100] flex justify-center px-4">
      <div role="status" aria-live="polite" className="pointer-events-auto flex max-w-[calc(100%-8px)] items-center gap-2 rounded-md px-3 py-2 shadow-lg slide-up" style={{ color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-card-hover)', backdropFilter: 'blur(16px)' }}>
        <Icon size={14} color={color} strokeWidth={2.5} />
        <span className="min-w-0 truncate text-[11px]">{toast.message}</span>
        {toast.action === 'undo-delete' && (
          <button onClick={async () => { await restoreLastDeleted(); dismissToast() }} className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold interactive-chip" style={{ color, background: `color-mix(in srgb, ${color} 11%, transparent)` }}>
            <RotateCcw size={11} />{t('toast.undo')}
          </button>
        )}
        <button onClick={dismissToast} className="action-btn" style={{ width: 22, height: 22 }} title={t('toast.close')}><X size={12} /></button>
      </div>
    </div>
  )
}

export default ToastCenter
