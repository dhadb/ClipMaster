import React, { memo, useMemo } from 'react'
import { FolderOpen, Search, Trash2 } from 'lucide-react'
import { createClipboardSearchIndex } from '../utils/clipboard'
import { filterHistory, useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const CollectionsPanel: React.FC = memo(() => {
  const history = useClipboardStore(state => state.history)
  const collections = useClipboardStore(state => state.settings.savedFilters)
  const updateSettings = useClipboardStore(state => state.updateSettings)
  const setActiveTab = useClipboardStore(state => state.setActiveTab)
  const setSearchQuery = useClipboardStore(state => state.setSearchQuery)
  const setFilterType = useClipboardStore(state => state.setFilterType)
  const setTimeFilter = useClipboardStore(state => state.setTimeFilter)
  const setSortMode = useClipboardStore(state => state.setSortMode)
  const { t } = useI18n()

  const collectionCounts = useMemo(() => {
    const searchIndex = createClipboardSearchIndex(history)
    return new Map(collections.map(collection => [
      collection.id,
      filterHistory(history, 'history', collection.query, collection.filterType, collection.sortMode, collection.timeFilter, searchIndex).length,
    ]))
  }, [collections, history])

  const applyCollection = (collection: typeof collections[number]) => {
    setActiveTab('history')
    setSearchQuery(collection.query)
    setFilterType(collection.filterType)
    setTimeFilter(collection.timeFilter)
    setSortMode(collection.sortMode)
  }

  const renameCollection = (id: string, label: string) => {
    const normalized = label.trim().slice(0, 32)
    if (!normalized) return
    void updateSettings({ savedFilters: collections.map(collection => collection.id === id ? { ...collection, label: normalized } : collection) })
  }

  const removeCollection = (id: string) => {
    void updateSettings({ savedFilters: collections.filter(collection => collection.id !== id) })
  }

  if (collections.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--bg-elevated)', color: 'var(--color-primary-light)' }}><FolderOpen size={22} /></div>
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('collections.empty')}</p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{t('collections.emptyDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('collections.title')}</h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-ghost)' }}>{t('collections.subtitle')}</p>
      </div>
      <div className="grid gap-2">
        {collections.map(collection => (
          <div key={collection.id} className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
            <div className="flex items-center gap-2">
              <FolderOpen size={14} style={{ color: 'var(--color-primary-light)' }} />
              <input
                defaultValue={collection.label}
                onBlur={event => renameCollection(collection.id, event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={t('collections.rename')}
              />
              <span className="rounded px-1.5 py-0.5 text-[10px] tabular-nums" style={{ background: 'var(--bg-elevated)', color: 'var(--text-ghost)' }}>{collectionCounts.get(collection.id) || 0}</span>
            </div>
            <div className="mt-2 truncate text-[10px] font-mono" style={{ color: 'var(--text-ghost)' }}>{collection.query || t('collections.noQuery')}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => applyCollection(collection)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}><Search size={11} />{t('collections.open')}</button>
              <button onClick={() => removeCollection(collection.id)} className="action-btn" title={t('collections.remove')}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default CollectionsPanel
