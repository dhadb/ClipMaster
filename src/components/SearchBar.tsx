import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Search, X, Sparkles, SlidersHorizontal } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const SearchBar: React.FC = () => {
  const setSearchQuery = useClipboardStore(s => s.setSearchQuery)
  const searchQuery = useClipboardStore(s => s.searchQuery)
  const history = useClipboardStore(s => s.history)
  const filteredLen = useClipboardStore(s => s.filteredHistory.length)
  const filterType = useClipboardStore(s => s.filterType)
  const setFilterType = useClipboardStore(s => s.setFilterType)

  const [local, setLocal] = useState(searchQuery)
  const [focused, setFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => { setLocal(searchQuery) }, [searchQuery])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocal(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSearchQuery(v), 120)
  }, [setSearchQuery])

  const onClear = useCallback(() => {
    setLocal('')
    setSearchQuery('')
    inputRef.current?.focus()
  }, [setSearchQuery])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { onClear(); inputRef.current?.blur() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClear])

  const stats = useMemo(() => ({
    pinned: history.filter(h => h.pinned).length,
    today: history.filter(h => new Date(h.timestamp).toDateString() === new Date().toDateString()).length,
  }), [history])

  const filters = useMemo(() => [
    { id: 'text', label: '文本', emoji: '📝' },
    { id: 'link', label: '链接', emoji: '🔗' },
    { id: 'code', label: '代码', emoji: '💻' },
    { id: 'email', label: '邮箱', emoji: '📧' },
    { id: 'color', label: '颜色', emoji: '🎨' },
  ], [])

  const onFilterClick = useCallback((id: string | null) => {
    setFilterType(filterType === id ? null : id)
  }, [filterType, setFilterType])

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="search-input rounded-xl overflow-hidden">
        <div className="flex items-center px-3 py-2.5">
          <Search size={16} color={focused ? '#4c6ef5' : 'rgba(144,146,150,0.5)'} style={{ transition: 'color 0.15s', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索剪贴板历史..."
            value={local}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="flex-1 bg-transparent border-none outline-none text-sm ml-2.5"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            {local && (
              <button onClick={onClear} className="action-btn" style={{ width: 28, height: 28 }}>
                <X size={14} />
              </button>
            )}
            <button onClick={() => setShowFilters(v => !v)} className={`action-btn ${showFilters ? 'expand' : ''}`} style={{ width: 28, height: 28 }}>
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>
        {focused && (
          <div className="px-3 pb-2 fade-in">
            <div className="flex items-center gap-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <div className="flex items-center gap-1">
                <Sparkles size={10} color="rgba(76,110,245,0.5)" />
                <span>{local || filterType ? `${filteredLen} 条结果` : `${history.length} 条记录`}</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
              <span>⭐ {stats.pinned} 收藏</span>
              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
              <span>📅 今日 {stats.today}</span>
            </div>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="flex items-center gap-1.5 px-1 overflow-x-auto fade-in" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => onFilterClick(null)} className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              background: !filterType ? 'rgba(76,110,245,0.2)' : 'rgba(255,255,255,0.05)',
              color: !filterType ? 'rgba(116,143,252,0.8)' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${!filterType ? 'rgba(76,110,245,0.3)' : 'rgba(255,255,255,0.05)'}`,
            }}>
            全部
          </button>
          {filters.map(f => (
            <button key={f.id} onClick={() => onFilterClick(f.id)} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                background: filterType === f.id ? 'rgba(76,110,245,0.2)' : 'rgba(255,255,255,0.05)',
                color: filterType === f.id ? 'rgba(116,143,252,0.8)' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${filterType === f.id ? 'rgba(76,110,245,0.3)' : 'rgba(255,255,255,0.05)'}`,
              }}>
              <span>{f.emoji}</span><span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(SearchBar)
