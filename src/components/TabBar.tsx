import React, { useCallback, useMemo, useRef, memo } from 'react'
import { Clock, Star, Trash2, Download, Upload, BarChart3, Wand2, ShieldX } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const TabBar: React.FC = memo(() => {
  const activeTab = useClipboardStore(s => s.activeTab)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)
  const clearHistory = useClipboardStore(s => s.clearHistory)
  const clearAllHistory = useClipboardStore(s => s.clearAllHistory)
  const importHistory = useClipboardStore(s => s.importHistory)
  const history = useClipboardStore(s => s.history)
  const settings = useClipboardStore(s => s.settings)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const replace = window.confirm('是否替换当前历史？\n\n确定：替换当前历史\n取消：合并到当前历史')
      const count = await importHistory(payload, replace ? 'replace' : 'merge')
      window.alert(count > 0 ? `已导入 ${count} 条记录` : '没有找到可导入的记录')
    } catch (err) {
      console.error('Import failed:', err)
      window.alert('导入失败：请选择 ClipMaster 导出的 JSON 文件')
    }
  }, [importHistory])

  const onClearKept = useCallback(() => {
    if (window.confirm('清空所有未收藏、未置顶的历史记录？')) clearHistory()
  }, [clearHistory])

  const onClearAll = useCallback(() => {
    if (window.confirm('确定清空全部历史记录？收藏、置顶和图片记录都会删除。')) clearAllHistory()
  }, [clearAllHistory])

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
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
        {activeTab === 'history' && (
          <>
            <button onClick={onSmartOrganize} className="action-btn" title="一键整理最近 20 条为 Markdown" style={{ width: 28, height: 28 }}>
              <Wand2 size={12} />
            </button>
            <button onClick={onImportClick} className="action-btn" title="导入 JSON" style={{ width: 28, height: 28 }}>
              <Upload size={12} />
            </button>
            <button onClick={onExport} className="action-btn" title="导出" style={{ width: 28, height: 28 }}>
              <Download size={12} />
            </button>
            {history.length > 0 && (
              <>
                <button onClick={onClearKept} className="action-btn delete" title="清空未收藏/未置顶"
                  style={{ width: 'auto', padding: '0 8px', height: 28, fontSize: 11, gap: 4 }}>
                  <Trash2 size={11} /><span>清空未收藏</span>
                </button>
                <button onClick={onClearAll} className="action-btn delete" title="清空全部历史" style={{ width: 28, height: 28 }}>
                  <ShieldX size={12} />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
})

TabBar.displayName = 'TabBar'
export default TabBar
