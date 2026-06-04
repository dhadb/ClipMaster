import React, { useCallback, memo } from 'react'
import { Copy, Pin, PinOff, Trash2, ExternalLink, Mail, Hash, Code, FileText, Type, Check, Heart } from 'lucide-react'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import ImagePreview from './ImagePreview'

interface Props {
  item: ClipboardItem
  isSelected: boolean
  onSelect: () => void
}

const TYPE_CFG: Record<string, { Icon: any; label: string; bar: string; cssVar: string }> = {
  text: { Icon: Type, label: '文本', bar: 'type-text', cssVar: 'var(--type-text)' },
  link: { Icon: ExternalLink, label: '链接', bar: 'type-link', cssVar: 'var(--type-link)' },
  email: { Icon: Mail, label: '邮箱', bar: 'type-email', cssVar: 'var(--type-email)' },
  color: { Icon: Hash, label: '颜色', bar: 'type-color', cssVar: 'var(--type-color)' },
  number: { Icon: Hash, label: '数字', bar: 'type-number', cssVar: 'var(--type-number)' },
  code: { Icon: Code, label: '代码', bar: 'type-code', cssVar: 'var(--type-code)' },
  json: { Icon: Code, label: 'JSON', bar: 'type-code', cssVar: 'var(--type-code)' },
  markdown: { Icon: FileText, label: 'Markdown', bar: 'type-long-text', cssVar: 'var(--type-long-text)' },
  'long-text': { Icon: FileText, label: '长文本', bar: 'type-long-text', cssVar: 'var(--type-long-text)' },
  'file-path': { Icon: FileText, label: '路径', bar: 'type-text', cssVar: 'var(--type-text)' },
  phone: { Icon: Hash, label: '电话', bar: 'type-number', cssVar: 'var(--type-number)' },
  image: { Icon: FileText, label: '图片', bar: 'type-long-text', cssVar: 'var(--type-long-text)' },
}

function isVerificationCode(content: string) {
  return /^\d{4,8}$/.test(content.trim())
}

function getPreviewText(item: ClipboardItem) {
  if (item.type === 'image') return '图片内容 · 点击查看详情或直接复制'
  return item.content.length > 96 ? `${item.content.slice(0, 96)}...` : item.content
}

const ClipboardItemCard: React.FC<Props> = memo(({ item, isSelected, onSelect }) => {
  const copyItem = useClipboardStore(s => s.copyItem)
  const deleteItem = useClipboardStore(s => s.deleteItem)
  const togglePin = useClipboardStore(s => s.togglePin)
  const toggleFavorite = useClipboardStore(s => s.toggleFavorite)
  const setDetailItemId = useClipboardStore(s => s.setDetailItemId)
  const copiedId = useClipboardStore(s => s.copiedId)
  const fontSize = useClipboardStore(s => s.settings.fontSize)
  const showPreview = useClipboardStore(s => s.settings.showPreview)
  const copyOnSelect = useClipboardStore(s => s.settings.copyOnSelect)

  const cfg = TYPE_CFG[item.type] || TYPE_CFG.text
  const isCopied = copiedId === item.id
  const timeAgo = formatDistanceToNow(item.timestamp, { locale: zhCN, addSuffix: true })
  const isCode = isVerificationCode(item.content)
  const preview = getPreviewText(item)

  const onCopy = useCallback((e: React.MouseEvent) => { e.stopPropagation(); copyItem(item.id) }, [copyItem, item.id])
  const onOpenDetail = useCallback(() => {
    onSelect()
    setDetailItemId(item.id)
  }, [item.id, onSelect, setDetailItemId])
  const onDoubleClickCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (copyOnSelect) copyItem(item.id)
  }, [copyOnSelect, copyItem, item.id])
  const onDelete = useCallback((e: React.MouseEvent) => { e.stopPropagation(); deleteItem(item.id) }, [deleteItem, item.id])
  const onPin = useCallback((e: React.MouseEvent) => { e.stopPropagation(); togglePin(item.id) }, [togglePin, item.id])
  const onFavorite = useCallback((e: React.MouseEvent) => { e.stopPropagation(); toggleFavorite(item.id) }, [toggleFavorite, item.id])

  const typeColor = cfg.cssVar
  const typeBg = `color-mix(in srgb, ${cfg.cssVar} 8%, transparent)`
  const meta = [
    isCode ? '验证码 · 临时保护' : null,
    item.content.length > 0 ? `${item.content.length} 字符` : null,
    (item.copyCount || 1) > 1 ? `复制 ${item.copyCount} 次` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      onClick={onOpenDetail}
      onDoubleClick={onDoubleClickCopy}
      className={`glass-card clipboard-card rounded-xl overflow-hidden cursor-pointer flex flex-col ${isSelected ? 'selected' : ''} ${isCode ? 'verification-card' : ''}`}
    >
      <div className={`type-bar ${cfg.bar} w-full`} style={{ height: 2 }} />
      <div className="flex-1 flex items-start gap-2.5 p-2.5 overflow-hidden">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center relative"
          style={{ background: typeBg }}
        >
          <cfg.Icon size={14} color={typeColor} strokeWidth={2} />
          {item.pinned && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center icon-badge"
              style={{ background: 'var(--color-warning)', boxShadow: '0 1px 4px rgba(251,191,36,0.3)' }}>
              <Pin size={7} color="white" strokeWidth={3} />
            </div>
          )}
          {item.favorited && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center icon-badge"
              style={{ background: '#f472b6', boxShadow: '0 1px 4px rgba(244,114,182,0.3)', right: item.pinned ? '-8px' : '-4px' }}>
              <Heart size={7} color="white" strokeWidth={3} fill="white" />
            </div>
          )}
        </div>

        {item.type === 'image' && <ImagePreview imagePath={item.imagePath} />}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1 min-w-0">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0"
              style={{ color: typeColor, background: typeBg }}
            >
              {cfg.label}
            </span>
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-ghost)' }}>{timeAgo}</span>
            {meta && <span className="text-[10px] truncate" style={{ color: 'var(--text-ghost)', opacity: 0.75 }}>{meta}</span>}
          </div>

          <p
            className={`text-[13px] leading-snug break-all ${showPreview ? 'line-clamp-2' : 'line-clamp-1'} ${isCode ? 'tracking-[0.22em] font-semibold' : ''}`}
            style={{ color: isCode ? 'var(--color-warning)' : 'var(--text-secondary)', fontSize: isCode ? fontSize + 2 : fontSize - 2 }}
          >
            {preview}
          </p>

          {item.type === 'color' && (
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <div className="w-3.5 h-3.5 rounded flex-shrink-0"
                style={{ background: item.content, border: '1px solid var(--border-card)' }} />
              <span className="text-[10px] font-mono truncate" style={{ color: 'var(--text-ghost)' }}>{item.content}</span>
            </div>
          )}
        </div>

        <div className="card-actions flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onCopy} className="action-btn copy" title="复制">
            {isCopied ? <Check size={13} color="var(--color-success)" strokeWidth={3} /> : <Copy size={13} />}
          </button>
          <button onClick={onPin} className={`action-btn pin ${item.pinned ? 'active' : ''}`} title={item.pinned ? '取消置顶' : '置顶'}>
            {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button onClick={onFavorite} className={`action-btn ${item.favorited ? 'active' : ''}`} title={item.favorited ? '取消收藏' : '收藏'}
            style={item.favorited ? { color: '#f472b6', background: 'rgba(244,114,182,0.12)' } : undefined}>
            <Heart size={13} fill={item.favorited ? '#f472b6' : 'none'} />
          </button>
          <button onClick={onDelete} className="action-btn delete" title="删除">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isCopied && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none copied-overlay"
          style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', borderRadius: 12 }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'var(--color-success)', boxShadow: '0 4px 16px rgba(52,211,153,0.3)' }}>
            <Check size={15} color="white" strokeWidth={3} />
            <span className="text-[13px] font-medium text-white">已复制</span>
          </div>
        </div>
      )}

      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r"
          style={{ background: 'linear-gradient(to bottom, var(--color-primary-light), var(--color-primary))' }} />
      )}
    </div>
  )
})

ClipboardItemCard.displayName = 'ClipboardItemCard'
export default ClipboardItemCard
