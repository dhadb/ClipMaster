import React, { useCallback, useMemo, memo } from 'react'
import { Clock, Star, Trash2, Download, BarChart3, Wand2 } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const TabBar: React.FC = memo(() => {
  const activeTab = useClipboardStore(s => s.activeTab)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)
  const clearHistory = useClipboardStore(s => s.clearHistory)
  const history = useClipboardStore(s => s.history)
  const settings = useClipboardStore(s => s.settings)

  const pinnedCount = useMemo(() => history.filter(h => h.favorited).length, [history])

  const tabs = useMemo(() => [
    { id: 'history' as const, label: '历史', Icon: Clock, count: history.length, activeColor: '#818cf8' },
    { id: 'favorites' as const, label: '收藏', Icon: Star, count: pinnedCount, activeColor: '#fbbf24' },
    { id: 'stats' as const, label: '统计', Icon: BarChart3, count: null, activeColor: '#34d399' },
  ], [history.length, pinnedCount])

  const onClick = useCallback((id: string) => {
    setActiveTab(id as any)
  }, [])

  const onExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: '1.0', items: history, settings }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = `clipmaster-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [history, settings])

  const onSmartOrganize = useCallback(async () => {
    const recent = history.slice(0, 20).map(item => item.content.trim()).filter(Boolean)
    const unique = Array.from(new Set(recent))
    const allLinks = unique.every(item => /^https?:\/\//i.test(item))
    const result = allLinks
      ? unique.map(item => `- ${item}`).join('\n')
      : unique.map((item, index) => `${index + 1}. ${item}`).join('\n')
    const markdown = `# ClipMaster 一键整理\n\n${result}`
    await window.electronAPI?.copyToClipboard(markdown)
  }, [history])

  return (
    <div className="flex items-center justify-between px-3 py-1 h-10"
      style={{ borderBottom: '1px solid var(--border-divider)' }}>
      <div className="flex items-center gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => {
          const active = activeTab === t.id
          return (
            <button key={t.id} onClick={() => onClick(t.id)} className={`tab-btn ${active ? 'active' : ''}`}>
              <t.Icon size={13} color={active ? t.activeColor : undefined} strokeWidth={active ? 2.5 : 2} />
              <span style={{ whiteSpace: 'nowrap' }}>{t.label}</span>
              {t.count !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{
                    background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                    color: active ? 'rgba(129,140,248,0.8)' : 'var(--text-ghost)',
                  }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-0.5" style={{ minWidth: '80px', justifyContent: 'flex-end' }}>
        {activeTab === 'history' && (
          <>
            <button onClick={onSmartOrganize} className="action-btn" title="一键整理最近 20 条为 Markdown" style={{ width: 28, height: 28 }}>
              <Wand2 size={12} />
            </button>
            <button onClick={onExport} className="action-btn" title="导出" style={{ width: 28, height: 28 }}>
              <Download size={12} />
            </button>
            {history.length > 0 && (
              <button onClick={clearHistory} className="action-btn delete"
                style={{ width: 'auto', padding: '0 10px', height: 28, fontSize: 11, gap: 4 }}>
                <Trash2 size={11} /><span>清空</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
})

TabBar.displayName = 'TabBar'
export default TabBar
