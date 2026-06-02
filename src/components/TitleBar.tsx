import React, { useCallback, memo } from 'react'
import { Minus, X, Maximize2, Clipboard } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const TitleBar: React.FC = memo(() => {
  const setShowSettings = useClipboardStore(s => s.setShowSettings)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)

  const onLogo = useCallback(() => { setShowSettings(false); setActiveTab('history') }, [])
  const onMin = useCallback(() => { window.electronAPI?.minimizeWindow() }, [])
  const onMax = useCallback(() => { window.electronAPI?.toggleMaximize() }, [])
  const onClose = useCallback(() => { window.electronAPI?.closeWindow() }, [])

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 drag-region select-none">
      <div className="flex items-center gap-2.5 cursor-pointer no-drag" onClick={onLogo}>
        <div className="relative w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #4c6ef5, #3b5bdb)', boxShadow: '0 4px 12px rgba(76,110,245,0.25)' }}>
          <Clipboard size={15} color="white" />
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 pulse-dot" style={{ borderColor: '#1a1b1e', background: '#20c997' }} />
        </div>
        <div>
          <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>ClipMaster</span>
          <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded-full font-medium" style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>PRO</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 no-drag">
        <button onClick={onMin} className="win-btn" title="最小化"><Minus size={15} /></button>
        <button onClick={onMax} className="win-btn" title="最大化"><Maximize2 size={13} /></button>
        <button onClick={onClose} className="win-btn close" title="关闭"><X size={15} /></button>
      </div>
    </div>
  )
})

TitleBar.displayName = 'TitleBar'
export default TitleBar
