import React, { memo, useMemo, useState } from 'react'
import { CheckSquare, Heart, Pin, Plus, Tag, Trash2, X } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const BulkActionBar: React.FC = memo(() => {
  const selectionMode = useClipboardStore(s => s.selectionMode)
  const selectedIds = useClipboardStore(s => s.selectedIds)
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const history = useClipboardStore(s => s.history)
  const clearSelection = useClipboardStore(s => s.clearSelection)
  const selectAllFiltered = useClipboardStore(s => s.selectAllFiltered)
  const batchUpdateItems = useClipboardStore(s => s.batchUpdateItems)
  const deleteItems = useClipboardStore(s => s.deleteItems)
  const notify = useClipboardStore(s => s.notify)
  const { t } = useI18n()
  const [tagDraft, setTagDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selected = useMemo(() => history.filter(item => selectedIds.includes(item.id)), [history, selectedIds])
  const allSelected = filteredHistory.length > 0 && filteredHistory.every(item => selectedIds.includes(item.id))
  const allPinned = selected.length > 0 && selected.every(item => item.pinned)
  const allFavorited = selected.length > 0 && selected.every(item => item.favorited)

  if (!selectionMode) return null

  const onDelete = async () => {
    const count = await deleteItems(selectedIds)
    setConfirmDelete(false)
    if (count > 0) notify(t('toast.deleted', { count }), 'success', 'undo-delete')
  }

  return (
    <div className="relative z-10 flex items-center gap-1.5 border-b px-3 py-2 fade-in" style={{ borderColor: 'var(--border-divider)', background: 'color-mix(in srgb, var(--color-primary) 5%, var(--bg-surface))' }}>
      <div className="flex min-w-0 items-center gap-2 mr-auto">
        <CheckSquare size={14} color="var(--color-primary-light)" />
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{t('bulk.selected', { count: selectedIds.length })}</span>
        <button onClick={allSelected ? clearSelection : selectAllFiltered} className="rounded px-1.5 py-1 text-[10px] interactive-chip" style={{ color: 'var(--color-primary-light)' }}>{allSelected ? t('bulk.clear') : t('bulk.all')}</button>
      </div>
      <button onClick={() => void batchUpdateItems(selectedIds, { pinned: !allPinned })} disabled={!selectedIds.length} className="action-btn pin disabled:opacity-30" title={allPinned ? t('item.unpin') : t('item.pin')}><Pin size={13} /></button>
      <button onClick={() => void batchUpdateItems(selectedIds, { favorited: !allFavorited })} disabled={!selectedIds.length} className="action-btn disabled:opacity-30" title={allFavorited ? t('item.unfavorite') : t('item.favorite')}><Heart size={13} fill={allFavorited ? '#f472b6' : 'none'} /></button>
      <div className="relative">
        <button onClick={() => setTagDraft(value => value ? '' : '#')} disabled={!selectedIds.length} className="action-btn disabled:opacity-30" title={t('bulk.addTag')}><Tag size={13} /></button>
        {tagDraft !== '' && (
          <div className="absolute right-0 top-8 z-30 flex items-center gap-1 rounded-md p-1.5 shadow-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card-hover)' }}>
            <input autoFocus value={tagDraft === '#' ? '' : tagDraft} onChange={event => setTagDraft(event.target.value)} onKeyDown={async event => { if (event.key === 'Enter') { await batchUpdateItems(selectedIds, { addTags: [tagDraft] }); setTagDraft('') } }} placeholder={t('tags.placeholder')} className="h-7 w-24 rounded px-2 text-[10px] outline-none" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }} />
            <button onClick={async () => { await batchUpdateItems(selectedIds, { addTags: [tagDraft] }); setTagDraft('') }} className="action-btn" style={{ width: 24, height: 24 }} title={t('bulk.addTag')}><Plus size={12} /></button>
          </div>
        )}
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1 rounded-md px-1" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}>
          <span className="px-1 text-[10px]" style={{ color: 'var(--color-danger)' }}>{t('bulk.deleteConfirm', { count: selectedIds.length })}</span>
          <button onClick={() => void onDelete()} className="action-btn delete" style={{ width: 25, height: 25 }} title={t('bulk.delete')}><CheckSquare size={12} /></button>
          <button onClick={() => setConfirmDelete(false)} className="action-btn" style={{ width: 25, height: 25 }} title={t('quickAdd.cancel')}><X size={12} /></button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} disabled={!selectedIds.length} className="action-btn delete disabled:opacity-30" title={t('bulk.delete')}><Trash2 size={13} /></button>
      )}
      <button onClick={clearSelection} className="action-btn" title={t('bulk.close')}><X size={13} /></button>
    </div>
  )
})

BulkActionBar.displayName = 'BulkActionBar'
export default BulkActionBar
