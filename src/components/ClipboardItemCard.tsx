import React, { useCallback, memo, useEffect, useRef, useState } from 'react'
import { Copy, Pin, PinOff, Trash2, ExternalLink, Mail, Hash, Code, FileText, FolderOpen, Type, Check, Heart, Circle, CheckCircle2, ListPlus, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'
import { getClipboardHighlightIndexes } from '../utils/clipboard'
import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import ImagePreview from './ImagePreview'
import { useI18n } from '../i18n'

interface Props {
  item: ClipboardItem
  isSelected: boolean
  onSelect: () => void
  selectionMode: boolean
  isChecked: boolean
  onToggleSelection: () => void
  variant?: 'quick' | 'library'
}

const TYPE_CFG: Record<string, { Icon: LucideIcon; bar: string; cssVar: string }> = {
  text: { Icon: Type, bar: 'type-text', cssVar: 'var(--type-text)' },
  link: { Icon: ExternalLink, bar: 'type-link', cssVar: 'var(--type-link)' },
  email: { Icon: Mail, bar: 'type-email', cssVar: 'var(--type-email)' },
  color: { Icon: Hash, bar: 'type-color', cssVar: 'var(--type-color)' },
  number: { Icon: Hash, bar: 'type-number', cssVar: 'var(--type-number)' },
  code: { Icon: Code, bar: 'type-code', cssVar: 'var(--type-code)' },
  json: { Icon: Code, bar: 'type-code', cssVar: 'var(--type-code)' },
  markdown: { Icon: FileText, bar: 'type-long-text', cssVar: 'var(--type-long-text)' },
  'long-text': { Icon: FileText, bar: 'type-long-text', cssVar: 'var(--type-long-text)' },
  'file-path': { Icon: FileText, bar: 'type-text', cssVar: 'var(--type-text)' },
  'file-list': { Icon: FolderOpen, bar: 'type-text', cssVar: 'var(--type-text)' },
  phone: { Icon: Hash, bar: 'type-number', cssVar: 'var(--type-number)' },
  image: { Icon: FileText, bar: 'type-long-text', cssVar: 'var(--type-long-text)' },
}

function isVerificationCode(content: string) {
  return /^\d{4,8}$/.test(content.trim())
}

function getPreviewText(item: ClipboardItem, imageText: string) {
  if (item.type === 'image') return imageText
  return item.content.length > 96 ? `${item.content.slice(0, 96)}...` : item.content
}

function renderHighlightedPreview(text: string, query: string) {
  const indexes = new Set(getClipboardHighlightIndexes(text, query))
  if (indexes.size === 0) return text
  const segments: React.ReactNode[] = []
  let start = 0
  while (start < text.length) {
    const highlighted = indexes.has(start)
    let end = start + 1
    while (end < text.length && indexes.has(end) === highlighted) end += 1
    const value = text.slice(start, end)
    segments.push(highlighted
      ? <mark key={start} className="rounded-sm px-px" style={{ color: 'var(--text-primary)', background: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>{value}</mark>
      : <React.Fragment key={start}>{value}</React.Fragment>)
    start = end
  }
  return segments
}

const ClipboardItemCard: React.FC<Props> = memo(({ item, isSelected, onSelect, selectionMode, isChecked, onToggleSelection, variant = 'quick' }) => {
  const copyItem = useClipboardStore(s => s.copyItem)
  const deleteItems = useClipboardStore(s => s.deleteItems)
  const togglePin = useClipboardStore(s => s.togglePin)
  const toggleFavorite = useClipboardStore(s => s.toggleFavorite)
  const setDetailItemId = useClipboardStore(s => s.setDetailItemId)
  const copiedId = useClipboardStore(s => s.copiedId)
  const fontSize = useClipboardStore(s => s.settings.fontSize)
  const showPreview = useClipboardStore(s => s.settings.showPreview)
  const copyOnSelect = useClipboardStore(s => s.settings.copyOnSelect)
  const searchQuery = useClipboardStore(s => s.searchQuery)
  const notify = useClipboardStore(s => s.notify)
  const addToStack = useClipboardStore(s => s.addToStack)
  const stackIds = useClipboardStore(s => s.stackIds)
  const { t, typeLabel, language } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  const cfg = TYPE_CFG[item.type] || TYPE_CFG.text
  const isCopied = copiedId === item.id
  const timeAgo = formatDistanceToNow(item.timestamp, { locale: language === 'zh-CN' ? zhCN : enUS, addSuffix: true })
  const isCode = isVerificationCode(item.content)
  const preview = getPreviewText(item, t('item.imagePreview'))

  const onCopy = useCallback((e: React.MouseEvent) => { e.stopPropagation(); copyItem(item.id) }, [copyItem, item.id])
  // 主点击区：multi 表示按住 Ctrl/Cmd（或处于多选模式），用于切换勾选而非打开详情
  const onOpenDetail = useCallback((multi: boolean) => {
    if (selectionMode || multi) {
      if (!selectionMode) useClipboardStore.getState().setSelectionMode(true)
      onToggleSelection()
      return
    }
    onSelect()
    if (variant === 'quick') setDetailItemId(item.id)
  }, [item.id, onSelect, onToggleSelection, selectionMode, setDetailItemId, variant])
  const onDoubleClickCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectionMode && (variant === 'quick' || copyOnSelect)) copyItem(item.id, { pasteAfterCopy: variant === 'quick' })
  }, [copyOnSelect, copyItem, item.id, selectionMode, variant])
  const onDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    void deleteItems([item.id]).then(count => {
      if (count > 0) notify(t('toast.deleted', { count }), 'success', 'undo-delete')
    })
  }, [deleteItems, item.id, notify, setMenuOpen, t])
  const onPin = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setMenuOpen(false); void togglePin(item.id) }, [item.id, setMenuOpen, togglePin])
  const onFavorite = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setMenuOpen(false); void toggleFavorite(item.id) }, [item.id, setMenuOpen, toggleFavorite])
  const onStack = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setMenuOpen(false); addToStack(item.id) }, [addToStack, item.id, setMenuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const typeColor = cfg.cssVar
  const typeBg = `color-mix(in srgb, ${cfg.cssVar} 8%, transparent)`
  // 主按钮的可读名称：优先用条目预览文本，图片等无文本时退回类型标签
  const cardAriaLabel = preview.trim() ? `${typeLabel(item.type)} · ${preview}` : typeLabel(item.type)
  const meta = [
    isCode ? t('item.verification') : null,
    item.content.length > 0 ? t('item.chars', { count: item.content.length }) : null,
    (item.copyCount || 1) > 1 ? t('item.copyCount', { count: item.copyCount }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className={`glass-card clipboard-card rounded-lg overflow-visible flex flex-col ${isSelected ? 'selected' : ''} ${isChecked ? 'checked' : ''} ${isCode ? 'verification-card' : ''} ${isCopied ? 'just-copied' : ''}`}
    >
      <div className={`type-bar ${cfg.bar} w-full`} style={{ height: 2 }} aria-hidden="true" />
      <div className="flex-1 flex items-stretch overflow-hidden">
        <button
          type="button"
          onClick={event => onOpenDetail(event.ctrlKey || event.metaKey)}
          onDoubleClick={onDoubleClickCopy}
          className="card-main flex-1 min-w-0 flex items-start gap-2.5 p-2.5 text-left cursor-pointer"
          aria-label={cardAriaLabel}
          aria-current={isSelected ? 'true' : undefined}
        >
          {selectionMode ? (
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
              style={{ color: isChecked ? 'var(--color-primary-light)' : 'var(--text-ghost)', background: isChecked ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--bg-surface)' }}
              aria-hidden="true"
            >
              {isChecked ? <CheckCircle2 size={16} strokeWidth={2.5} /> : <Circle size={16} />}
            </span>
          ) : <span
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center relative"
            style={{ background: typeBg }}
            aria-hidden="true"
          >
            <cfg.Icon size={14} color={typeColor} strokeWidth={2} />
            {item.pinned && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center icon-badge"
                style={{ background: 'var(--color-warning)', boxShadow: '0 1px 4px var(--color-warning-glow)' }}>
                <Pin size={7} color="white" strokeWidth={3} />
              </span>
            )}
            {item.favorited && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center icon-badge"
                style={{ background: 'var(--color-favorite)', boxShadow: '0 1px 4px var(--color-favorite-glow)', right: item.pinned ? '-8px' : '-4px' }}>
                <Heart size={7} color="white" strokeWidth={3} fill="white" />
              </span>
            )}
          </span>}

          {item.type === 'image' && <ImagePreview imagePath={item.imagePath} />}

          <span className="flex-1 min-w-0 flex flex-col">
            <span className="flex items-center gap-1.5 mb-1 min-w-0">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0"
                style={{ color: typeColor, background: typeBg }}
              >
                {typeLabel(item.type)}
              </span>
              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-ghost)' }}>{timeAgo}</span>
              {meta && <span className="text-[10px] truncate" style={{ color: 'var(--text-ghost)', opacity: 0.75 }}>{meta}</span>}
              {item.tags?.[0] && (
                <span className="text-[9px] truncate px-1.5 py-0.5 rounded flex-shrink" style={{ color: 'var(--color-primary-light)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                  #{item.tags[0]}{item.tags.length > 1 ? ` +${item.tags.length - 1}` : ''}
                </span>
              )}
              {item.workspace && (
                <span className="text-[9px] truncate px-1.5 py-0.5 rounded flex-shrink" title={item.workspace} style={{ color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 10%, transparent)' }}>
                  {item.workspace}
                </span>
              )}
            </span>

            <span
              className={`text-[13px] leading-snug break-all ${showPreview ? 'line-clamp-2' : 'line-clamp-1'} ${isCode ? 'font-mono font-semibold' : ''}`}
              style={{ color: isCode ? 'var(--color-warning)' : 'var(--text-secondary)', fontSize: isCode ? fontSize + 2 : fontSize - 2 }}
            >
              {renderHighlightedPreview(preview, searchQuery)}
            </span>

            {item.type === 'color' && (
              <span className="flex items-center gap-1.5 mt-1 min-w-0">
                <span className="w-3.5 h-3.5 rounded flex-shrink-0"
                  style={{ background: item.content, border: '1px solid var(--border-card)' }} />
                <span className="text-[10px] font-mono truncate" style={{ color: 'var(--text-ghost)' }}>{item.content}</span>
              </span>
            )}
          </span>
        </button>

        {!selectionMode && <div ref={actionsRef} className="card-actions relative flex items-center gap-0.5 flex-shrink-0 self-start mt-2.5 mr-2.5">
          <button onClick={onCopy} className="action-btn copy" title={t('item.copy')} aria-label={t('item.copy')}>
            {isCopied ? <Check size={13} color="var(--color-success)" strokeWidth={3} /> : <Copy size={13} />}
          </button>
          <button
            onClick={event => { event.stopPropagation(); setMenuOpen(value => !value) }}
            className={`action-btn ${menuOpen ? 'active' : ''}`}
            title={t('tabs.more')}
            aria-label={t('tabs.more')}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              onClick={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
              className="card-menu absolute right-0 top-8 z-30 w-44 rounded-md p-1 shadow-xl fade-in"
              role="menu"
              tabIndex={-1}
            >
              <button onClick={onPin} className="menu-item" role="menuitem">
                {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                {item.pinned ? t('item.unpin') : t('item.pin')}
              </button>
              <button
                onClick={onFavorite}
                className="menu-item"
                role="menuitem"
                style={item.favorited ? { color: 'var(--color-favorite)' } : undefined}
              >
                <Heart size={13} fill={item.favorited ? 'var(--color-favorite)' : 'none'} />
                {item.favorited ? t('item.unfavorite') : t('item.favorite')}
              </button>
              <button onClick={onStack} disabled={stackIds.includes(item.id)} className="menu-item disabled:opacity-40" role="menuitem">
                <ListPlus size={13} />
                {stackIds.includes(item.id) ? t('stack.queued') : t('stack.add')}
              </button>
              <div className="my-1 h-px" style={{ background: 'var(--border-divider)' }} />
              <button onClick={onDelete} className="menu-item danger" role="menuitem">
                <Trash2 size={13} />
                {t('item.delete')}
              </button>
            </div>
          )}
        </div>}
      </div>

      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r"
          style={{ background: 'linear-gradient(to bottom, var(--color-primary-light), var(--color-primary))' }}
          aria-hidden="true" />
      )}
      {isCopied && <div className="copy-feedback-rail" aria-hidden="true" />}
    </div>
  )
})

ClipboardItemCard.displayName = 'ClipboardItemCard'
export default ClipboardItemCard
