import React from 'react'
import { Download, ExternalLink, RotateCw, X } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const UpdateBanner: React.FC = () => {
  const info = useClipboardStore(state => state.updateInfo)
  const status = useClipboardStore(state => state.updateStatus)
  const dismissed = useClipboardStore(state => state.updateDismissed)
  const dismiss = useClipboardStore(state => state.dismissUpdate)
  const downloadUpdate = useClipboardStore(state => state.downloadUpdate)
  const installUpdate = useClipboardStore(state => state.installUpdate)
  const progress = useClipboardStore(state => state.updateDownloadProgress)
  const { t } = useI18n()

  if (!info || dismissed || !['available', 'downloading', 'downloaded', 'installing'].includes(status)) return null

  const progressPercent = progress.percent === null ? null : Math.max(0, Math.min(100, progress.percent))

  return (
    <div className="flex min-h-9 items-center gap-2 px-3 py-1.5" style={{ color: 'var(--text-secondary)', background: 'color-mix(in srgb, var(--color-warning) 9%, var(--bg-app))', borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 20%, var(--border-divider))' }}>
      {status === 'downloaded' || status === 'installing' ? <RotateCw size={13} color="var(--color-primary-light)" className={status === 'installing' ? 'animate-spin' : 'flex-shrink-0'} /> : <Download size={13} color="var(--color-warning)" className="flex-shrink-0" />}
      <span className="min-w-0 flex-1 truncate text-[11px]">
        {status === 'available' && t('update.banner', { version: info.latestVersion })}
        {status === 'downloading' && (progressPercent === null ? t('update.downloading') : t('update.progress', { percent: progressPercent }))}
        {status === 'downloaded' && t('update.downloaded')}
        {status === 'installing' && t('update.installing')}
      </span>
      {status === 'available' && <button onClick={() => void downloadUpdate()} className="rounded-md px-2 py-1 text-[10px] font-medium interactive-chip" style={{ color: 'white', background: 'var(--color-primary)' }}>{t('update.download')}</button>}
      {status === 'downloaded' && <button onClick={() => void installUpdate()} className="rounded-md px-2 py-1 text-[10px] font-medium interactive-chip" style={{ color: 'white', background: 'var(--color-primary)' }}><RotateCw size={11} className="mr-1 inline" />{t('update.install')}</button>}
      {status === 'available' && <button onClick={() => void window.electronAPI?.openExternalUrl(info.releaseUrl)} className="action-btn" style={{ width: 24, height: 24 }} title={t('update.view')}><ExternalLink size={12} /></button>}
      <button onClick={dismiss} className="action-btn" style={{ width: 24, height: 24 }} title={t('update.dismiss')}><X size={12} /></button>
    </div>
  )
}

export default React.memo(UpdateBanner)
