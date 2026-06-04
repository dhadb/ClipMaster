import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Search, X, SlidersHorizontal, Star } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const SearchBar: React.FC = () => {
  const setSearchQuery = useClipboardStore(s => s.setSearchQuery)
  const searchQuery = useClipboardStore(s => s.searchQuery)
  const history = useClipboardStore(s => s.history)
  const filteredLen = useClipboardStore(s => s.filteredHistory.length)
  const filterType = useClipboardStore(s => s.filterType)
  const setFilterType = useClipboardStore(s => s.setFilterType)
  const activeTab = useClipboardStore(s => s.activeTab)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)

  const [local, setLocal] = useState(searchQuery)
  const [focused, setFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => { setLocal(searchQuery) }, [searchQuery])

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') { onClear(); inputRef.current?.blur() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClear])

  const stats = useMemo(() => ({
    favorited: history.filter(h => h.favorited).length,
    today: history.filter(h => new Date(h.timestamp).toDateString() === new Date().toDateString()).length,
  }), [history])

  const filters = useMemo(() => [
    { id: 'text', label: '文本', icon: 'T' },
    { id: 'link', label: '链接', icon: '↗' },
    { id: 'code', label: '代码', icon: '<>' },
    { id: 'email', label: '邮箱', icon: '@' },
    { id: 'color', label: '颜色', icon: '●' },
  ], [])

  const onFilterClick = useCallback((id: string | null) => {
    setFilterType(filterType === id ? null : id)
  }, [filterType, setFilterType])

  const resultCount = local || filterType ? filteredLen : history.length

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* 搜索框 */}
      <div className="search-input rounded-xl overflow-hidden">
        <div className="flex items-center px-3 py-2">
          <Search size={15} color={focused ? 'var(--color-primary)' : 'var(--text-placeholder)'}
            style={{ transition: 'color 0.15s', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索剪贴板内容..."
            value={local}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="flex-1 bg-transparent border-none outline-none text-[13px] ml-2.5"
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {local && (
              <button onClick={onClear} className="action-btn" style={{ width: 28, height: 28 }}>
                <X size={13} />
              </button>
            )}
            <button onClick={() => setShowFilters(v => !v)}
              className={`action-btn ${showFilters ? 'expand' : ''}`}
              style={{ width: 28, height: 28 }}>
              <SlidersHorizontal size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 状态栏 - 固定高度，始终显示 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px', minHeight: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-ghost)', whiteSpace: 'nowrap' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{resultCount}</span>
          <span>条记录</span>
          {(local || filterType) && resultCount !== history.length && (
            <span style={{ opacity: 0.6 }}>/ {history.length} 总计</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <button
            onClick={() => setActiveTab(activeTab === 'favorites' ? 'history' : 'favorites')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '10px',
              color: activeTab === 'favorites' ? '#fbbf24' : 'var(--text-ghost)',
              opacity: activeTab === 'favorites' ? 1 : 0.6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            title={activeTab === 'favorites' ? '返回历史' : '查看收藏'}
          >
            <Star size={10} fill={activeTab === 'favorites' ? '#fbbf24' : 'none'} strokeWidth={2} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.favorited}</span>
          </button>
          <span style={{ fontSize: '10px', color: 'var(--text-ghost)', opacity: 0.3 }}>|</span>
          <span style={{ fontSize: '10px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-ghost)', opacity: 0.6 }}>
            今日 {stats.today}
          </span>
        </div>
      </div>

      {/* 筛选器 */}
      {showFilters && (
        <div className="flex items-center gap-1 px-0.5 overflow-x-auto fade-in" style={{ scrollbarWidth: 'none', marginTop: '6px' }}>
          <button onClick={() => onFilterClick(null)}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background: !filterType ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: !filterType ? 'rgba(129,140,248,0.9)' : 'var(--text-tertiary)',
              border: `1px solid ${!filterType ? 'rgba(99,102,241,0.2)' : 'transparent'}`,
            }}>
            全部
          </button>
          {filters.map(f => (
            <button key={f.id} onClick={() => onFilterClick(f.id)}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: filterType === f.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: filterType === f.id ? 'rgba(129,140,248,0.9)' : 'var(--text-tertiary)',
                border: `1px solid ${filterType === f.id ? 'rgba(99,102,241,0.2)' : 'transparent'}`,
              }}>
              <span className="text-[10px] opacity-60">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(SearchBar)
