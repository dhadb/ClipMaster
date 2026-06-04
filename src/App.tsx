import React, { useEffect, useState, useMemo } from 'react'
import TitleBar from './components/TitleBar'
import SearchBar from './components/SearchBar'
import TabBar from './components/TabBar'
import ClipboardList from './components/ClipboardList'
import SettingsPanel from './components/SettingsPanel'
import StatsPanel from './components/StatsPanel'
import EmptyState from './components/EmptyState'
import { useClipboardStore } from './store/clipboardStore'

function getResolvedTheme(theme: 'dark' | 'light' | 'auto'): 'dark' | 'light' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function App() {
  const activeTab = useClipboardStore(s => s.activeTab)
  const showSettings = useClipboardStore(s => s.showSettings)
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const history = useClipboardStore(s => s.history)
  const settings = useClipboardStore(s => s.settings)
  const privacy = useClipboardStore(s => s.privacy)
  const pauseMonitoring = useClipboardStore(s => s.pauseMonitoring)
  const resumeMonitoring = useClipboardStore(s => s.resumeMonitoring)
  const setHistory = useClipboardStore(s => s.setHistory)
  const setSettings = useClipboardStore(s => s.setSettings)
  const setShowSettings = useClipboardStore(s => s.setShowSettings)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 立即应用主题 (同步执行，避免闪烁)
  const resolvedTheme = useMemo(() => getResolvedTheme(settings.theme), [settings.theme])

  // 使用 useLayoutEffect 同步设置主题属性，在浏览器绘制前完成
  React.useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // 同步字体大小到 html 根元素，使 rem 单位生效
  React.useLayoutEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`
  }, [settings.fontSize])

  // 监听系统主题变化 (auto 模式)
  useEffect(() => {
    if (settings.theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const t = mq.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', t)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  useEffect(() => {
    let isMounted = true
    const cleanups: (() => void)[] = []

    const addCleanup = (cleanup: (() => void) | undefined) => {
      if (!cleanup) return
      if (isMounted) {
        cleanups.push(cleanup)
        return
      }
      try { cleanup() } catch (e) { console.error('Cleanup error:', e) }
    }

    const init = async () => {
      try {
        if (!window.electronAPI) {
          if (isMounted) setLoaded(true)
          return
        }

        addCleanup(window.electronAPI.onHistoryUpdated((newHistory) => {
          if (isMounted) setHistory(newHistory)
        }))
        addCleanup(window.electronAPI.onSettingsUpdated((newSettings) => {
          if (isMounted) setSettings(newSettings)
        }))
        addCleanup(window.electronAPI.onPrivacyUpdated((state) => {
          if (isMounted) useClipboardStore.getState().setPrivacy(state)
        }))
        addCleanup(window.electronAPI.onShowSettings(() => {
          if (isMounted) {
            setShowSettings(true)
            setActiveTab('settings')
          }
        }))

        const [hist, s, privacy] = await Promise.all([
          window.electronAPI.getHistory(),
          window.electronAPI.getSettings(),
          window.electronAPI.getPrivacyState(),
        ])

        if (!isMounted) return

        setHistory(hist)
        setSettings(s)
        useClipboardStore.getState().setPrivacy(privacy)
        setLoaded(true)
      } catch (err) {
        console.error('Failed to initialize:', err)
        if (isMounted) {
          setError('加载失败，请重启应用')
          setLoaded(true)
        }
      }
    }
    init()

    return () => {
      isMounted = false
      cleanups.splice(0).forEach(fn => {
        try { fn() } catch (e) { console.error('Cleanup error:', e) }
      })
    }
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
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-root)' }}>
        <div className="flex flex-col items-center gap-4 fade-in">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
          </div>
          <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>加载中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-root)' }}>
        <div className="flex flex-col items-center gap-3">
          <span className="text-[13px]" style={{ color: 'var(--color-danger)' }}>{error}</span>
          <button onClick={() => window.location.reload()}
            className="text-[12px] px-4 py-2 rounded-lg"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-card)',
            }}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden rounded-2xl glass-effect flex flex-col"
      style={{ opacity: settings.opacity, transform: 'translateZ(0)' }}
    >
      <TitleBar />
      {showSearch && <SearchBar />}
      <TabBar />
      <div className="flex-1 overflow-hidden">{content}</div>
      <div className="px-4 py-1.5 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border-divider)' }}>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-ghost)' }}>
          <div className="pulse-dot" style={privacy.paused ? { background: 'var(--color-warning)' } : undefined} />
          <span>{privacy.paused ? '已暂停记录' : '监控中'}</span>
          <span style={{ color: 'var(--text-ghost)', opacity: 0.4 }}>·</span>
          <span>{history.length} 条记录</span>
          <span style={{ color: 'var(--text-ghost)', opacity: 0.4 }}>·</span>
          <span>今日保护 {privacy.protectedToday} 条</span>
        </div>
        <button
          onClick={() => privacy.paused ? resumeMonitoring() : pauseMonitoring(5)}
          className="text-[10px] px-2 py-1 rounded-md transition-all"
          style={{ color: privacy.paused ? 'var(--color-success)' : 'var(--text-ghost)', background: 'var(--bg-surface)' }}
        >
          {privacy.paused ? '恢复记录' : '暂停 5 分钟'}
        </button>
      </div>
    </div>
  )
}

export default App
