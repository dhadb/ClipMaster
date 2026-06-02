import React, { useCallback, useMemo, memo } from 'react'
import { Clock, Star, Settings, Trash2, Download, BarChart3 } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const TabBar: React.FC = memo(() => {
  const activeTab = useClipboardStore(s => s.activeTab)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)
  const setShowSettings = useClipboardStore(s => s.setShowSettings)
  const clearHistory = useClipboardStore(s => s.clearHistory)
  const history = useClipboardStore(s => s.history)
  const settings = useClipboardStore(s => s.settings)

  const pinnedCount = useMemo(() => history.filter(h => h.pinned).length, [history])

  const tabs = useMemo(() => [
    { id: 'history' as const, label: '历史', Icon: Clock, count: history.length, activeColor: '#5c7cfa' },
    { id: 'favorites' as const, label: '收藏', Icon: Star, count: pinnedCount, activeColor: '#fab005' },
    { id: 'stats' as const, label: '统计', Icon: BarChart3, count: null, activeColor: '#20c997' },
    { id: 'settings' as const, label: '设置', Icon: Settings, count: null, activeColor: '#845ef7' },
  ], [history.length, pinnedCount])

  const onClick = useCallback((id: string) => {
    setActiveTab(id as any)
    setShowSettings(id === 'settings')
  }, [])

  const onExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: '1.0', items: history, settings }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `clipmaster-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [history, settings])

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
      <div className="flex items-center gap-0.5">
        {tabs.map(t => {
          const active = activeTab === t.id
          return (
            <button key={t.id} onClick={() => onClick(t.id)} className={`tab-btn ${active ? 'active' : ''}`}>
              <t.Icon size={13} color={active ? t.activeColor : undefined} />
              <span>{t.label}</span>
              {t.count !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: active ? 'rgba(76,110,245,0.2)' : 'rgba(255,255,255,0.05)', color: active ? 'rgba(116,143,252,0.8)' : 'rgba(255,255,255,0.25)' }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {activeTab === 'history' && (
        <div className="flex items-center gap-1">
          <button onClick={onExport} className="action-btn" title="导出" style={{ width: 28, height: 28 }}>
            <Download size={11} />
          </button>
          {history.length > 0 && (
            <button onClick={clearHistory} className="action-btn delete" style={{ width: 'auto', padding: '0 8px', height: 28, fontSize: 11, gap: 4 }}>
              <Trash2 size={11} /><span>清空</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
})

TabBar.displayName = 'TabBar'
export default TabBar
