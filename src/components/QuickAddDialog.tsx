import React, { useCallback, useEffect, useState } from 'react'
import { FilePlus2, Heart, Pin, Save, X } from 'lucide-react'
import TagInput from './TagInput'
import Modal from './ui/Modal'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const TITLE_ID = 'quick-add-dialog-title'

const QuickAddDialog: React.FC = () => {
  const open = useClipboardStore(state => state.quickAddOpen)
  const setOpen = useClipboardStore(state => state.setQuickAddOpen)
  const addItem = useClipboardStore(state => state.addItem)
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [pinned, setPinned] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const close = useCallback(() => {
    if (!saving) setOpen(false)
  }, [saving, setOpen])

  const submit = useCallback(async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await addItem({ content, tags, pinned, favorited })
    } catch (err) {
      console.error('createItem failed:', err)
      setError(t('quickAdd.failed'))
    } finally {
      setSaving(false)
    }
  }, [addItem, content, favorited, pinned, saving, t, tags])

  // 每次打开都要重置表单。TL 用 key 重挂载更"正统"，但本对话框由 store 的开关驱动，
  // 重挂载会丢掉 Modal 的进出场动画，收益不抵代价。
  /* eslint-disable react-hooks/set-state-in-effect -- 打开时重置表单是预期行为 */
  useEffect(() => {
    if (!open) return
    setContent('')
    setTags([])
    setPinned(false)
    setFavorited(false)
    setError('')
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Escape 由 Modal 基座统一处理，这里只保留 Ctrl/Cmd+Enter 提交
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, submit])

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy={TITLE_ID}
      as="form"
      onSubmit={() => void submit()}
      maxWidth="28rem"
      zIndex={60}
      blur={10}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-divider)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              color: 'var(--color-primary-light)',
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            }}
          >
            <FilePlus2 size={15} />
          </div>
          <div>
            <h2 id={TITLE_ID} className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('quickAdd.title')}
            </h2>
            <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>
              {t('quickAdd.subtitle')}
            </p>
          </div>
        </div>
        <button type="button" onClick={close} className="action-btn" title={t('quickAdd.cancel')} aria-label={t('quickAdd.cancel')}>
          <X size={15} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <label className="block">
          <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {t('quickAdd.content')}
          </span>
          <textarea
            data-autofocus
            value={content}
            onChange={event => setContent(event.target.value)}
            rows={7}
            className="w-full resize-none rounded-lg px-3 py-2.5 text-[12px] leading-relaxed outline-none"
            style={{ color: 'var(--text-primary)', background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
            placeholder={t('quickAdd.placeholder')}
          />
        </label>

        <div>
          <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {t('quickAdd.tags')}
          </span>
          <TagInput value={tags} onChange={setTags} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}
          >
            <input
              type="checkbox"
              checked={favorited}
              onChange={event => setFavorited(event.target.checked)}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <Heart
              size={13}
              color={favorited ? 'var(--color-favorite)' : 'var(--text-tertiary)'}
              fill={favorited ? 'var(--color-favorite)' : 'none'}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {t('quickAdd.favorite')}
            </span>
          </label>
          <label
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}
          >
            <input
              type="checkbox"
              checked={pinned}
              onChange={event => setPinned(event.target.checked)}
              style={{ accentColor: 'var(--color-warning)' }}
            />
            <Pin size={13} color={pinned ? 'var(--color-warning)' : 'var(--text-tertiary)'} />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {t('quickAdd.pin')}
            </span>
          </label>
        </div>

        {error && (
          <p className="text-[11px]" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-divider)' }}>
        <button
          type="button"
          onClick={close}
          className="h-9 px-4 rounded-lg text-[12px] interactive-chip"
          style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
        >
          {t('quickAdd.cancel')}
        </button>
        <button
          type="submit"
          disabled={!content.trim() || saving}
          className="h-9 px-4 rounded-lg text-[12px] font-medium flex items-center gap-2 disabled:opacity-40 interactive-chip"
          style={{ color: 'white', background: 'var(--color-primary)' }}
        >
          <Save size={13} />
          {saving ? t('quickAdd.saving') : t('quickAdd.save')}
        </button>
      </div>
    </Modal>
  )
}

export default QuickAddDialog
