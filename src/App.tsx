import React, { Suspense, useEffect, useState, useMemo, useRef } from 'react'
import TitleBar from './components/TitleBar'
import SearchBar from './components/SearchBar'
import TabBar from './components/TabBar'
import ClipboardList from './components/ClipboardList'
import EmptyState from './components/EmptyState'
import UpdateBanner from './components/UpdateBanner'
import { Clipboard } from 'lucide-react'
import { useClipboardStore } from './store/clipboardStore'
import { useI18n } from './i18n'
import { resolveTheme } from './theme'
import { accentPalettes } from './personalization'
import BulkActionBar from './components/BulkActionBar'
import ToastCenter from './components/ToastCenter'
import PrivacyStatusBar from './components/PrivacyStatusBar'

const ClipboardDetail = React.lazy(() => import('./components/ClipboardDetail'))
const SettingsPanel = React.lazy(() => import('./components/SettingsPanel'))
const StatsPanel = React.lazy(() => import('./components/StatsPanel'))
const CollectionsPanel = React.lazy(() => import('./components/CollectionsPanel'))
const QuickAddDialog = React.lazy(() => import('./components/QuickAddDialog'))

function PanelLoading() {
  return (
    <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
      <div className="w-7 h-7 rounded-lg shimmer" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  )
}

function App() {
  const activeTab = useClipboardStore(s => s.activeTab)
  const showSettings = useClipboardStore(s => s.showSettings)
  const detailItemId = useClipboardStore(s => s.detailItemId)
  const quickAddOpen = useClipboardStore(s => s.quickAddOpen)
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const settings = useClipboardStore(s => s.settings)
  const setHistory = useClipboardStore(s => s.setHistory)
  const setSettings = useClipboardStore(s => s.setSettings)
  const setShowSettings = useClipboardStore(s => s.setShowSettings)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)
  const setQuickAddOpen = useClipboardStore(s => s.setQuickAddOpen)
  const setAppVersion = useClipboardStore(s => s.setAppVersion)
  const checkForUpdates = useClipboardStore(s => s.checkForUpdates)
  const { t } = useI18n()

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const checkedForUpdates = useRef(false)

  // 立即应用主题，同步执行，避免闪烁
  const resolvedTheme = useMemo(() => resolveTheme(settings.theme, window.matchMedia('(prefers-color-scheme: dark)').matches), [settings.theme])

  // 使用 useLayoutEffect 同步设置主题属性，在浏览器绘制前完成
  React.useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // 同步字体大小到 html 根元素，使 rem 单位生效
  React.useLayoutEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`
  }, [settings.fontSize])

  React.useLayoutEffect(() => {
    const root = document.documentElement
    if (settings.accentColor === 'theme') {
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-light')
      root.style.removeProperty('--color-primary-dark')
      return
    }
    const palette = accentPalettes[settings.accentColor]
    root.style.setProperty('--color-primary', palette.primary)
    root.style.setProperty('--color-primary-light', palette.light)
    root.style.setProperty('--color-primary-dark', palette.dark)
  }, [settings.accentColor, resolvedTheme])

  // 监听系统主题变化 (auto 模式)
  useEffect(() => {
    if (settings.theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme('auto', mq.matches))
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
        addCleanup(window.electronAPI.onUpdateDownloadProgress((progress) => {
          if (isMounted) useClipboardStore.setState({ updateDownloadProgress: progress })
        }))
        addCleanup(window.electronAPI.onFocusSearch(() => {
          if (!isMounted) return
          setShowSettings(false)
          setActiveTab('history')
          setTimeout(() => window.dispatchEvent(new Event('clipmaster-focus-search')), 0)
        }))
        addCleanup(window.electronAPI.onShowSettings(() => {
          if (isMounted) {
            setShowSettings(true)
            setActiveTab('settings')
          }
        }))

        const [hist, s, privacy, version] = await Promise.all([
          window.electronAPI.getHistory(),
          window.electronAPI.getSettings(),
          window.electronAPI.getPrivacyState(),
          window.electronAPI.getAppVersion(),
        ])

        if (!isMounted) return

        setHistory(hist)
        setSettings(s)
        useClipboardStore.getState().setPrivacy(privacy)
        setAppVersion(version)
        setLoaded(true)
      } catch (err) {
        console.error('Failed to initialize:', err)
        if (isMounted) {
          setError(true)
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

  useEffect(() => {
    if (!loaded || !settings.autoCheckUpdates || checkedForUpdates.current) return
    checkedForUpdates.current = true
    void checkForUpdates()
  }, [checkForUpdates, loaded, settings.autoCheckUpdates])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        const target = event.target as HTMLElement | null
        const isEditing = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        )
        if (isEditing) return
        event.preventDefault()
        setQuickAddOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setQuickAddOpen])

  const showSearch = activeTab !== 'settings' && activeTab !== 'stats' && activeTab !== 'collections'

  const content = useMemo(() => {
    if (activeTab === 'settings' || showSettings) return <Suspense fallback={<PanelLoading />}><SettingsPanel /></Suspense>
    if (activeTab === 'collections') return <Suspense fallback={<PanelLoading />}><CollectionsPanel /></Suspense>
    if (activeTab === 'stats') return <Suspense fallback={<PanelLoading />}><StatsPanel /></Suspense>
    if (filteredHistory.length === 0) return <EmptyState />
    return <ClipboardList />
  }, [activeTab, showSettings, filteredHistory.length])

  if (!loaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-root)' }}>
        <div className="flex flex-col items-center gap-4 fade-in">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shimmer soft-float"
            style={{
              color: 'white',
              background: 'var(--color-primary)',
              boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary) 28%, transparent)',
            }}>
            <Clipboard size={20} strokeWidth={2.5} />
          </div>
          <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{t('app.loading')}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-root)' }}>
        <div className="flex flex-col items-center gap-3">
          <span className="text-[13px]" style={{ color: 'var(--color-danger)' }}>{t('app.loadFailed')}</span>
          <button onClick={() => window.location.reload()}
            className="text-[12px] px-4 py-2 rounded-lg interactive-chip"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-card)',
            }}>
            {t('app.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden rounded-xl glass-effect flex flex-col"
      style={{ opacity: settings.opacity, transform: 'translateZ(0)' }}
    >
      <TitleBar />
      <UpdateBanner />
      {showSearch && <SearchBar />}
      {!showSettings && activeTab !== 'settings' && <TabBar />}
      {showSearch && <BulkActionBar />}
      <div key={`${activeTab}-${showSettings ? 'settings' : 'content'}`} className="flex-1 overflow-hidden content-fade">{content}</div>
      <Suspense fallback={null}>{detailItemId && <ClipboardDetail />}</Suspense>
      <Suspense fallback={null}>{quickAddOpen && <QuickAddDialog />}</Suspense>
      <ToastCenter />
      <PrivacyStatusBar />
    </div>
  )
}

export default App
