import React, { useEffect, useState, useMemo } from 'react'
import TitleBar from './components/TitleBar'
import SearchBar from './components/SearchBar'
import TabBar from './components/TabBar'
import ClipboardList from './components/ClipboardList'
import SettingsPanel from './components/SettingsPanel'
import StatsPanel from './components/StatsPanel'
import EmptyState from './components/EmptyState'
import { useClipboardStore } from './store/clipboardStore'

function App() {
  const activeTab = useClipboardStore(s => s.activeTab)
  const showSettings = useClipboardStore(s => s.showSettings)
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const history = useClipboardStore(s => s.history)
  const settings = useClipboardStore(s => s.settings)
  const setHistory = useClipboardStore(s => s.setHistory)
  const setSettings = useClipboardStore(s => s.setSettings)
  const setShowSettings = useClipboardStore(s => s.setShowSettings)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cleanups: (() => void)[] = []

    const init = async () => {
      try {
        if (window.electronAPI) {
          const [hist, s] = await Promise.all([
            window.electronAPI.getHistory(),
            window.electronAPI.getSettings(),
          ])
          setHistory(hist)
          setSettings(s)

          const c1 = window.electronAPI.onHistoryUpdated(setHistory)
          const c2 = window.electronAPI.onSettingsUpdated(setSettings)
          const c3 = window.electronAPI.onShowSettings(() => {
            setShowSettings(true)
            setActiveTab('settings')
          })
          cleanups.push(c1, c2, c3)
        }
        setLoaded(true)
      } catch (err) {
        console.error('Failed to initialize:', err)
        setError('加载失败，请重启应用')
        setLoaded(true)
      }
    }
    init()

    return () => { cleanups.forEach(fn => fn()) }
  }, [])

  const showSearch = activeTab !== 'settings' && activeTab !== 'stats'

  const content = useMemo(() => {
    if (activeTab === 'settings' || showSettings) return <SettingsPanel />
    if (activeTab === 'stats') return <StatsPanel />
    if (filteredHistory.length === 0) return <EmptyState />
    return <ClipboardList />
  }, [activeTab, showSettings, filteredHistory.length])

  if (!loaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#141517' }}>
        <div className="flex flex-col items-center gap-3 fade-in">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4c6ef5, #3b5bdb)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
          </div>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>加载中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#141517' }}>
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm" style={{ color: '#ff6b6b' }}>{error}</span>
          <button onClick={() => window.location.reload()} className="text-xs px-4 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>重试</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden rounded-xl glass-effect flex flex-col"
      style={{ opacity: settings.opacity, transform: 'translateZ(0)' }}
    >
      <TitleBar />
      {showSearch && <SearchBar />}
      <TabBar />
      <div className="flex-1 overflow-hidden">{content}</div>
      <div className="px-4 py-1.5 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          <div className="pulse-dot" />
          <span>监控中</span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span>{history.length} 条记录</span>
        </div>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Ctrl+Shift+V 唤起</div>
      </div>
    </div>
  )
}

export default App
