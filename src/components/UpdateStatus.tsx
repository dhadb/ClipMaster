import React from 'react'
import { AlertCircle, CheckCircle2, Download, ExternalLink, RefreshCw, RotateCw } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const UpdateStatus: React.FC = () => {
  const appVersion = useClipboardStore(state => state.appVersion)
  const updateInfo = useClipboardStore(state => state.updateInfo)
  const status = useClipboardStore(state => state.updateStatus)
  const progress = useClipboardStore(state => state.updateDownloadProgress)
  const checkForUpdates = useClipboardStore(state => state.checkForUpdates)
  const downloadUpdate = useClipboardStore(state => state.downloadUpdate)
  const installUpdate = useClipboardStore(state => state.installUpdate)
  const { t } = useI18n()

  const openRelease = () => {
    if (updateInfo?.releaseUrl) void window.electronAPI?.openExternalUrl(updateInfo.releaseUrl)
  }

  const statusText = status === 'available'
    ? t('update.available', { version: updateInfo?.latestVersion || '' })
    : status === 'downloading'
      ? t('update.downloading')
      : status === 'downloaded'
        ? t('update.downloaded')
        : status === 'installing'
          ? t('update.installing')
      : status === 'current'
        ? t('update.current')
      : status === 'error'
        ? t('update.failed')
        : t('update.ready')

  const StatusIcon = status === 'available' || status === 'downloading'
    ? Download
    : status === 'downloaded' || status === 'installing'
      ? RotateCw
    : status === 'error'
      ? AlertCircle
      : status === 'current'
        ? CheckCircle2
        : RefreshCw
  const statusColor = status === 'available' || status === 'downloading'
    ? 'var(--color-warning)'
    : status === 'downloaded' || status === 'installing'
      ? 'var(--color-primary-light)'
    : status === 'error'
      ? 'var(--color-danger)'
      : status === 'current'
        ? 'var(--color-success)'
        : 'var(--text-tertiary)'

  const progressPercent = progress.percent === null ? null : Math.max(0, Math.min(100, progress.percent))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusIcon size={15} color={statusColor} className={status === 'checking' || status === 'installing' ? 'animate-spin' : ''} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{statusText}</p>
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-ghost)' }}>{t('update.installed', { version: appVersion || '...' })}</p>
          </div>
        </div>
        {status === 'available' && (
          <button onClick={() => void downloadUpdate()} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}>
            <Download size={12} />{t('update.download')}
          </button>
        )}
        {status === 'downloaded' && (
          <button onClick={() => void installUpdate()} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}>
            <RotateCw size={12} />{t('update.install')}
          </button>
        )}
        {status === 'error' && updateInfo?.hasUpdate && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => void downloadUpdate()} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}>
              <Download size={12} />{t('update.retry')}
            </button>
            <button onClick={openRelease} className="action-btn" style={{ width: 30, height: 30 }} title={t('update.view')}><ExternalLink size={13} /></button>
          </div>
        )}
      </div>
      {status === 'downloading' && (
        <div className="space-y-1.5 px-1">
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-elevated)' }}>
            <div className="h-full transition-all" style={{ width: `${progressPercent ?? 15}%`, background: 'var(--color-primary)' }} />
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>
            {progressPercent === null ? t('update.downloading') : t('update.progress', { percent: progressPercent })}
          </p>
        </div>
      )}
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
