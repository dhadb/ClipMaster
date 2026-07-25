import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AtSign,
  Braces,
  CalendarDays,
  Clock3,
  Code2,
  FileImage,
  FileText,
  Hash,
  Link2,
  ListFilter,
  MapPin,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Type,
  X,
} from 'lucide-react'
import { useClipboardStore, type SortMode, type TimeFilter } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const SearchBar: React.FC = () => {
  const setSearchQuery = useClipboardStore(s => s.setSearchQuery)
  const searchQuery = useClipboardStore(s => s.searchQuery)
  const history = useClipboardStore(s => s.history)
  const filteredLen = useClipboardStore(s => s.filteredHistory.length)
  const filterType = useClipboardStore(s => s.filterType)
  const setFilterType = useClipboardStore(s => s.setFilterType)
  const sortMode = useClipboardStore(s => s.sortMode)
  const setSortMode = useClipboardStore(s => s.setSortMode)
  const timeFilter = useClipboardStore(s => s.timeFilter)
  const setTimeFilter = useClipboardStore(s => s.setTimeFilter)
  const resetFilters = useClipboardStore(s => s.resetFilters)
  const setQuickAddOpen = useClipboardStore(s => s.setQuickAddOpen)
  const { t } = useI18n()

  const [local, setLocal] = useState(searchQuery)
  const [focused, setFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocal(searchQuery) }, [searchQuery])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setLocal(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSearchQuery(value), 100)
  }, [setSearchQuery])

  const onClear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setLocal('')
    setSearchQuery('')
    inputRef.current?.focus()
  }, [setSearchQuery])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !event.altKey && !event.shiftKey) {
        const target = event.target as HTMLElement | null
        const isEditing = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        )
        if (isEditing && target !== inputRef.current) return
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        onClear()
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClear])

  const filters = useMemo(() => [
    { id: 'text', label: t('type.text'), Icon: Type },
    { id: 'link', label: t('type.link'), Icon: Link2 },
    { id: 'email', label: t('type.email'), Icon: AtSign },
    { id: 'color', label: t('type.color'), Icon: Sparkles },
    { id: 'number', label: t('type.number'), Icon: Hash },
    { id: 'code', label: t('type.code'), Icon: Code2 },
    { id: 'json', label: t('type.json'), Icon: Braces },
    { id: 'markdown', label: t('type.markdown'), Icon: FileText },
    { id: 'file-path', label: t('type.file-path'), Icon: MapPin },
    { id: 'phone', label: t('type.phone'), Icon: Phone },
    { id: 'image', label: t('type.image'), Icon: FileImage },
  ], [t])

  const sortOptions: Array<{ id: SortMode; label: string }> = [
    { id: 'newest', label: t('search.sortNewest') },
    { id: 'oldest', label: t('search.sortOldest') },
    { id: 'most-used', label: t('search.sortUsed') },
  ]
  const timeOptions: Array<{ id: TimeFilter; label: string; Icon: typeof Clock3 }> = [
    { id: 'all', label: t('search.timeAll'), Icon: Clock3 },
    { id: 'today', label: t('search.timeToday'), Icon: CalendarDays },
    { id: 'week', label: t('search.timeWeek'), Icon: CalendarDays },
  ]

  const hasFilter = Boolean(local || filterType || timeFilter !== 'all' || sortMode !== 'newest')
  const activeFilterCount = Number(Boolean(filterType)) + Number(timeFilter !== 'all') + Number(sortMode !== 'newest')

  return (
    <div className="px-3 pb-2 pt-2">
      <div className={`search-input overflow-hidden rounded-lg ${focused ? 'is-focused' : ''}`}>
        <div className="flex h-10 items-center px-3">
          <Search size={15} color={focused ? 'var(--color-primary)' : 'var(--text-placeholder)'} className="flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            placeholder={t('search.placeholder')}
            value={local}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="ml-2.5 min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="flex flex-shrink-0 items-center gap-0.5">
            {local && <button onClick={onClear} className="action-btn scale-in" title={t('search.clear')}><X size={13} /></button>}
            <button onClick={() => setQuickAddOpen(true)} className="action-btn" title={t('search.addSnippet')}><Plus size={14} /></button>
            <button onClick={() => setShowFilters(value => !value)} className={`action-btn ${showFilters || activeFilterCount ? 'active' : ''}`} title={t('search.filters')}>
              <SlidersHorizontal size={13} />
              {activeFilterCount > 0 && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-primary-light)' }} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-7 items-center justify-between px-1 pt-1.5 text-[10px]" style={{ color: 'var(--text-ghost)' }}>
        <span>{hasFilter ? t('search.resultSummary', { count: filteredLen, total: history.length }) : t('search.totalSummary', { count: history.length })}</span>
        {hasFilter && <button onClick={() => { onClear(); resetFilters() }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 interactive-chip" style={{ color: 'var(--color-primary-light)' }}><X size={10} />{t('search.reset')}</button>}
      </div>

      {showFilters && (
        <div className="filter-panel mt-1 space-y-2 rounded-lg p-2.5 fade-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
          <div className="flex items-center gap-2">
            <ListFilter size={12} color="var(--text-ghost)" />
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setFilterType(null)} className={`filter-chip ${!filterType ? 'active' : ''}`}>{t('search.all')}</button>
              {filters.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setFilterType(filterType === id ? null : id)} className={`filter-chip ${filterType === id ? 'active' : ''}`} title={label}>
                  <Icon size={11} /><span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="segmented-control">
              {timeOptions.map(({ id, label }) => <button key={id} onClick={() => setTimeFilter(id)} className={timeFilter === id ? 'active' : ''}>{label}</button>)}
            </div>
            <div className="segmented-control">
              {sortOptions.map(({ id, label }) => <button key={id} onClick={() => setSortMode(id)} className={sortMode === id ? 'active' : ''}>{label}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(SearchBar)
