import React, { useState, useCallback, memo } from 'react'
import { Copy, Pin, PinOff, Trash2, ExternalLink, Mail, Hash, Code, FileText, Type, Check, Eye, EyeOff, Heart } from 'lucide-react'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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
  'file-path': { Icon: FileText, label: '路径', bar: 'type-text', cssVar: 'var(--type-text)' },
  phone: { Icon: Hash, label: '电话', bar: 'type-number', cssVar: 'var(--type-number)' },
}

const ClipboardItemCard: React.FC<Props> = memo(({ item, isSelected, onSelect }) => {
  const copyItem = useClipboardStore(s => s.copyItem)
  const deleteItem = useClipboardStore(s => s.deleteItem)
  const togglePin = useClipboardStore(s => s.togglePin)
  const toggleFavorite = useClipboardStore(s => s.toggleFavorite)
  const copiedId = useClipboardStore(s => s.copiedId)
  const fontSize = useClipboardStore(s => s.settings.fontSize)
  const showPreview = useClipboardStore(s => s.settings.showPreview)
  const copyOnSelect = useClipboardStore(s => s.settings.copyOnSelect)

  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const cfg = TYPE_CFG[item.type] || TYPE_CFG.text
  const isCopied = copiedId === item.id

  const timeAgo = formatDistanceToNow(item.timestamp, { locale: zhCN, addSuffix: true })
  const firstTimeAgo = formatDistanceToNow(item.firstTimestamp || item.timestamp, { locale: zhCN, addSuffix: true })
  const truncated = item.content.length > 120 ? item.content.slice(0, 120) + '...' : item.content

  const onCopy = useCallback((e: React.MouseEvent) => { e.stopPropagation(); copyItem(item.id) }, [copyItem, item.id])
  const onDoubleClickCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (copyOnSelect) copyItem(item.id)
  }, [copyOnSelect, copyItem, item.id])
  const onDelete = useCallback((e: React.MouseEvent) => { e.stopPropagation(); deleteItem(item.id) }, [deleteItem, item.id])
  const onPin = useCallback((e: React.MouseEvent) => { e.stopPropagation(); togglePin(item.id) }, [togglePin, item.id])
  const onFavorite = useCallback((e: React.MouseEvent) => { e.stopPropagation(); toggleFavorite(item.id) }, [toggleFavorite, item.id])
  const onExpand = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setExpanded(v => !v) }, [])

  // 类型颜色和背景 - 使用 CSS 变量自动适配主题
  const typeColor = cfg.cssVar
  const typeBg = `color-mix(in srgb, ${cfg.cssVar} 8%, transparent)`

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClickCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`glass-card rounded-xl overflow-hidden cursor-pointer h-full flex flex-col ${isSelected ? 'selected' : ''}`}
      style={{ willChange: 'transform' }}
    >
      <div className={`type-bar ${cfg.bar} w-full`} style={{ height: 2 }} />
      <div className="flex-1 flex items-start gap-3 p-3 overflow-hidden">
        {/* 类型图标 */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center relative"
          style={{ background: typeBg }}
        >
          <cfg.Icon size={14} color={typeColor} strokeWidth={2} />
          {item.pinned && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-warning)', boxShadow: '0 1px 4px rgba(251,191,36,0.3)' }}>
              <Pin size={7} color="white" strokeWidth={3} />
            </div>
          )}
          {item.favorited && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: '#f472b6', boxShadow: '0 1px 4px rgba(244,114,182,0.3)', right: item.pinned ? '-8px' : '-4px' }}>
              <Heart size={7} color="white" strokeWidth={3} fill="white" />
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: typeColor, background: typeBg }}
            >
              {cfg.label}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>{timeAgo}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-ghost)', opacity: 0.6 }}>{item.content.length}字符</span>
            {(item.copyCount || 1) > 1 && <span className="text-[10px]" style={{ color: 'var(--text-ghost)', opacity: 0.6 }}>复制{item.copyCount}次</span>}
          </div>

          <p
            className={`text-[13px] leading-relaxed break-all ${expanded ? '' : 'line-clamp-2'}`}
            style={{ color: 'var(--text-secondary)', fontSize: fontSize - 2 }}
          >
            {expanded ? item.content : truncated}
          </p>

          {showPreview && item.type === 'color' && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ background: 'var(--bg-overlay)' }}>
              <div className="w-6 h-6 rounded-md"
                style={{ background: item.content, border: '1px solid var(--border-card)' }} />
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{item.content}</span>
            </div>
          )}

          {showPreview && item.type === 'link' && (
            <div className="mt-1.5 px-2 py-1.5 rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--type-link) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--type-link) 8%, transparent)' }}>
              <span className="text-[11px] truncate block" style={{ color: 'color-mix(in srgb, var(--type-link) 65%, transparent)' }}>{item.content}</span>
            </div>
          )}

          {showPreview && (item.type === 'code' || item.type === 'json' || item.type === 'markdown') && (
            <div className="mt-1.5 p-2 rounded-lg"
              style={{ background: 'var(--bg-overlay)', border: '1px solid color-mix(in srgb, var(--type-code) 8%, transparent)' }}>
              <pre className="text-[11px] font-mono overflow-x-auto" style={{ color: 'color-mix(in srgb, var(--type-code) 55%, transparent)' }}>
                <code>{item.content.slice(0, 150)}{item.content.length > 150 ? '...' : ''}</code>
              </pre>
            </div>
          )}

          {expanded && (
            <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-ghost)' }}>
              <span>{item.content.length} 字符</span>
              <span>·</span>
              <span>{item.content.split(/\s+/).filter(Boolean).length} 词</span>
              <span>·</span>
              <span>{item.content.split('\n').length} 行</span>
              {(item.copyCount || 1) > 1 && <>
                <span>·</span>
                <span>复制过 {item.copyCount} 次，首次 {firstTimeAgo}</span>
              </>}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0 fade-in">
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
            <button onClick={onExpand} className="action-btn expand" title={expanded ? '收起' : '展开'}>
              {expanded ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button onClick={onDelete} className="action-btn delete" title="删除">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 已复制覆盖 */}
      {isCopied && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none copied-overlay"
          style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', backdropFilter: 'blur(4px)', borderRadius: 12 }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'var(--color-success)', boxShadow: '0 4px 16px rgba(52,211,153,0.3)' }}>
            <Check size={15} color="white" strokeWidth={3} />
            <span className="text-[13px] font-medium text-white">已复制</span>
          </div>
        </div>
      )}

      {/* 选中指示 */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r"
          style={{ background: 'linear-gradient(to bottom, var(--color-primary-light), var(--color-primary))' }} />
      )}
    </div>
  )
})

ClipboardItemCard.displayName = 'ClipboardItemCard'
export default ClipboardItemCard
