import React, { memo } from 'react'
import { ChevronRight, ClipboardList, Copy, X } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const ClipboardStackBar: React.FC = memo(() => {
  const stackIds = useClipboardStore(s => s.stackIds)
  const history = useClipboardStore(s => s.history)
  const copyNextStackItem = useClipboardStore(s => s.copyNextStackItem)
  const removeFromStack = useClipboardStore(s => s.removeFromStack)
  const clearStack = useClipboardStore(s => s.clearStack)
  const { t } = useI18n()
  const items = stackIds.map(id => history.find(item => item.id === id)).filter(Boolean)
  if (items.length === 0) return null

  return (
    <div key={items.length} className="stack-bar relative z-10 flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-divider)', background: 'color-mix(in srgb, var(--color-success) 6%, var(--bg-surface))' }}>
      <ClipboardList size={14} color="var(--color-success)" />
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{t('stack.title', { count: items.length })}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {items.slice(0, 4).map((item, index) => item && (
          <button key={item.id} onClick={() => removeFromStack(item.id)} className="stack-chip inline-flex max-w-[120px] items-center gap-1 rounded-md px-1.5 py-1 text-[10px] interactive-chip" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }} title={t('stack.remove')}>
            <span className="text-[9px]" style={{ color: 'var(--color-success)' }}>{index + 1}</span>
            <span className="truncate">{item.content || t('type.image')}</span><X size={10} />
          </button>
        ))}
        {items.length > 4 && <span className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>+{items.length - 4}</span>}
      </div>
      <button onClick={() => void copyNextStackItem()} className="action-btn" title={t('stack.copyNext')}><Copy size={13} /></button>
      <button onClick={clearStack} className="action-btn" title={t('stack.clear')}><X size={13} /></button>
      <ChevronRight size={12} color="var(--text-ghost)" />
    </div>
  )
})

ClipboardStackBar.displayName = 'ClipboardStackBar'
export default ClipboardStackBar
