import React, { memo, useCallback, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { MAX_TAGS, normalizeTags } from '../utils/clipboard'
import { useI18n } from '../i18n'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void | Promise<void>
  compact?: boolean
}

const TagInput: React.FC<Props> = memo(({ value, onChange, compact = false }) => {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')

  const addDraft = useCallback(() => {
    const candidates = draft.split(/[,，\n]/)
    const next = normalizeTags([...value, ...candidates])
    if (next.length !== value.length) void onChange(next)
    setDraft('')
  }, [draft, onChange, value])

  const removeTag = useCallback((tag: string) => {
    void onChange(value.filter(item => item !== tag))
  }, [onChange, value])

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'min-h-[34px]'}`}>
      {value.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
          style={{ color: 'var(--color-primary-light)', background: 'color-mix(in srgb, var(--color-primary) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)' }}
        >
          #{tag}
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100" title={t('tags.remove')}>
            <X size={10} />
          </button>
        </span>
      ))}
      {value.length < MAX_TAGS && (
        <div className="flex items-center gap-1 min-w-[112px] flex-1">
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={addDraft}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
                event.preventDefault()
                event.stopPropagation()
                addDraft()
              }
            }}
            className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-[11px] outline-none"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
            placeholder={t('tags.placeholder')}
            aria-label={t('tags.add')}
          />
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={addDraft} disabled={!draft.trim()} className="action-btn disabled:opacity-30" title={t('tags.add')}>
            <Plus size={12} />
          </button>
        </div>
      )}
    </div>
  )
})

TagInput.displayName = 'TagInput'
export default TagInput
