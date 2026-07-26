import React, { memo, useEffect, useMemo, useState } from 'react'
import { ChevronUp, Clock3, ShieldCheck } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const PrivacyStatusBar: React.FC = memo(() => {
  const privacy = useClipboardStore(s => s.privacy)
  const historyLength = useClipboardStore(s => s.history.length)
  const pauseMonitoring = useClipboardStore(s => s.pauseMonitoring)
  const resumeMonitoring = useClipboardStore(s => s.resumeMonitoring)
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [now, tick] = useState(Date.now())

  useEffect(() => {
    if (!privacy.paused) return
    const timer = window.setInterval(() => tick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [privacy.paused])

  const remaining = useMemo(() => {
    if (!privacy.paused) return ''
    if (privacy.pauseMode === 'until-resume') return t('app.pauseUntilResume')
    if (privacy.pauseMode === 'application') return t('app.pauseCurrentApp')
    const seconds = Math.max(0, Math.ceil((privacy.pauseUntil - now) / 1000))
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
  }, [now, privacy.pauseMode, privacy.paused, privacy.pauseUntil, t])

  return (
    <div className="relative flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--border-divider)' }}>
      <div className="flex min-w-0 items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        <span className="pulse-dot" style={privacy.paused ? { background: 'var(--color-warning)', boxShadow: 'none' } : undefined} />
        <span className="truncate">{privacy.paused ? t('app.paused') : t('app.monitoring')}</span>
        <span className="text-[9px]" style={{ color: 'var(--text-ghost)' }}>·</span>
        <span className="tabular-nums">{t('app.records', { count: historyLength })}</span>
        <span className="text-[9px]" style={{ color: 'var(--text-ghost)' }}>·</span>
        <span className="tabular-nums truncate">{t('app.protectedSkipped', { count: privacy.protectedToday })}</span>
      </div>
      <div className="relative flex-shrink-0">
        <button onClick={() => setOpen(value => !value)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] interactive-chip" style={{ color: privacy.paused ? 'var(--color-warning)' : 'var(--text-tertiary)', background: 'var(--bg-surface)' }}>
          {privacy.paused ? <Clock3 size={11} /> : <ShieldCheck size={11} />}
          {privacy.paused ? remaining : t('app.pause5')}
          <ChevronUp size={11} style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 120ms ease' }} />
        </button>
        {open && (
          <div className="absolute bottom-[calc(100%+8px)] right-0 z-20 min-w-[150px] overflow-hidden rounded-md p-1 shadow-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card-hover)', backdropFilter: 'blur(18px)' }}>
            {privacy.paused ? (
              <button onClick={() => { void resumeMonitoring(); setOpen(false) }} className="w-full rounded px-2.5 py-2 text-left text-[11px] interactive-chip" style={{ color: 'var(--color-success)' }}>{t('app.resume')}</button>
            ) : [
              ...[5, 30, 60].map(minutes => (
                <button key={minutes} onClick={() => { void pauseMonitoring(minutes); setOpen(false) }} className="w-full rounded px-2.5 py-2 text-left text-[11px] interactive-chip" style={{ color: 'var(--text-secondary)' }}>{t('app.pauseMinutes', { count: minutes })}</button>
              )),
              <button key="until-resume" onClick={() => { void pauseMonitoring('until-resume'); setOpen(false) }} className="w-full rounded px-2.5 py-2 text-left text-[11px] interactive-chip" style={{ color: 'var(--text-secondary)' }}>{t('app.pauseUntilResume')}</button>,
              <button key="current-application" onClick={() => { void pauseMonitoring('current-application'); setOpen(false) }} className="w-full rounded px-2.5 py-2 text-left text-[11px] interactive-chip" style={{ color: 'var(--text-secondary)' }}>{t('app.pauseCurrentApp')}</button>,
            ]}
          </div>
        )}
      </div>
    </div>
  )
})

PrivacyStatusBar.displayName = 'PrivacyStatusBar'
export default PrivacyStatusBar
