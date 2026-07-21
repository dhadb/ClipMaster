import React, { useCallback, memo } from 'react'
import { Minus, X, Maximize2, Settings, Edit3 } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const appIconUrl = './icon.png'

const TitleBar: React.FC = memo(() => {
  const showSettings = useClipboardStore(s => s.showSettings)
  const setShowSettings = useClipboardStore(s => s.setShowSettings)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)
  const setQuickAddOpen = useClipboardStore(s => s.setQuickAddOpen)
  const privacy = useClipboardStore(s => s.privacy)
  const { t } = useI18n()

  const onLogo = useCallback(() => { setShowSettings(false); setActiveTab('history') }, [])
  const onSettings = useCallback(() => {
    const next = !showSettings
    setShowSettings(next)
    setActiveTab(next ? 'settings' : 'history')
  }, [showSettings])
  const onMin = useCallback(() => { window.electronAPI?.minimizeWindow() }, [])
  const onMax = useCallback(() => { window.electronAPI?.toggleMaximize() }, [])
  const onClose = useCallback(() => { window.electronAPI?.closeWindow() }, [])

  return (
    <div className="flex h-12 items-center justify-between px-3 drag-region select-none"
      style={{ borderBottom: '1px solid var(--border-divider)' }}>
      <div className="flex items-center gap-2.5 cursor-pointer no-drag" onClick={onLogo}>
        <div className="relative w-7 h-7 rounded-md flex items-center justify-center">
          <img
            src={appIconUrl}
            alt=""
            className="w-7 h-7 rounded-md"
            draggable={false}
            style={{ boxShadow: '0 2px 8px rgba(15,118,110,0.25)' }}
          />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full icon-badge"
            style={{
              background: privacy.paused ? 'var(--color-warning)' : 'var(--color-success)',
              boxShadow: privacy.paused ? 'none' : 'var(--shadow-glow)',
              border: '1.5px solid var(--bg-root)',
            }} />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            ClipMaster
          </span>
          <span className="text-[9px]" style={{ color: privacy.paused ? 'var(--color-warning)' : 'var(--text-ghost)' }}>{privacy.paused ? t('app.paused') : t('app.localFirst')}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 no-drag">
        <button onClick={() => setQuickAddOpen(true)} className="win-btn" title={t('search.addSnippet')}><Edit3 size={14} /></button>
        <button onClick={onSettings} className={`win-btn ${showSettings ? 'active' : ''}`} title={t('title.settings')}>
          <Settings size={14} />
        </button>
        <button onClick={onMin} className="win-btn" title={t('title.minimize')}><Minus size={14} /></button>
        <button onClick={onMax} className="win-btn" title={t('title.maximize')}><Maximize2 size={12} /></button>
        <button onClick={onClose} className="win-btn close" title={t('title.close')}><X size={14} /></button>
      </div>
    </div>
  )
})

TitleBar.displayName = 'TitleBar'
export default TitleBar
