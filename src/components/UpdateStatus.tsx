import React from 'react'
import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const UpdateStatus: React.FC = () => {
  const appVersion = useClipboardStore(state => state.appVersion)
  const updateInfo = useClipboardStore(state => state.updateInfo)
  const status = useClipboardStore(state => state.updateStatus)
  const checkForUpdates = useClipboardStore(state => state.checkForUpdates)
  const { t } = useI18n()

  const openRelease = () => {
    if (updateInfo?.releaseUrl) void window.electronAPI?.openExternalUrl(updateInfo.releaseUrl)
  }

  const statusText = status === 'available'
    ? t('update.available', { version: updateInfo?.latestVersion || '' })
    : status === 'current'
      ? t('update.current')
      : status === 'error'
        ? t('update.failed')
        : t('update.ready')

  const StatusIcon = status === 'available'
    ? Download
    : status === 'error'
      ? AlertCircle
      : status === 'current'
        ? CheckCircle2
        : RefreshCw
  const statusColor = status === 'available'
    ? 'var(--color-warning)'
    : status === 'error'
      ? 'var(--color-danger)'
      : status === 'current'
        ? 'var(--color-success)'
        : 'var(--text-tertiary)'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusIcon size={15} color={statusColor} className={status === 'checking' ? 'animate-spin' : ''} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{statusText}</p>
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-ghost)' }}>{t('update.installed', { version: appVersion || '...' })}</p>
          </div>
        </div>
        {status === 'available' && (
          <button onClick={openRelease} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}>
            <Download size={12} />{t('update.download')}
          </button>
        )}
      </div>
      <button
        onClick={() => void checkForUpdates(true)}
        disabled={status === 'checking'}
        className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] interactive-chip disabled:opacity-50"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-card)' }}
      >
        <RefreshCw size={12} className={status === 'checking' ? 'animate-spin' : ''} />
        {status === 'checking' ? t('update.checking') : t('update.check')}
      </button>
    </div>
  )
}

export default React.memo(UpdateStatus)
