import React from 'react'
import { Download, X } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const UpdateBanner: React.FC = () => {
  const info = useClipboardStore(state => state.updateInfo)
  const status = useClipboardStore(state => state.updateStatus)
  const dismissed = useClipboardStore(state => state.updateDismissed)
  const dismiss = useClipboardStore(state => state.dismissUpdate)
  const { t } = useI18n()

  if (status !== 'available' || !info || dismissed) return null

  return (
    <div className="flex min-h-9 items-center gap-2 px-3 py-1.5" style={{ color: 'var(--text-secondary)', background: 'color-mix(in srgb, var(--color-warning) 9%, var(--bg-app))', borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 20%, var(--border-divider))' }}>
      <Download size={13} color="var(--color-warning)" className="flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[11px]">{t('update.banner', { version: info.latestVersion })}</span>
      <button onClick={() => void window.electronAPI?.openExternalUrl(info.releaseUrl)} className="rounded-md px-2 py-1 text-[10px] font-medium interactive-chip" style={{ color: 'white', background: 'var(--color-primary)' }}>{t('update.view')}</button>
      <button onClick={dismiss} className="action-btn" style={{ width: 24, height: 24 }} title={t('update.dismiss')}><X size={12} /></button>
    </div>
  )
}

export default React.memo(UpdateBanner)
