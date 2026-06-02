import React, { useState, useCallback, memo } from 'react'
import { Copy, Pin, PinOff, Trash2, ExternalLink, Mail, Hash, Code, FileText, Type, Check, Eye, EyeOff } from 'lucide-react'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Props {
  item: ClipboardItem
  isSelected: boolean
  onSelect: () => void
}

const TYPE_CFG: Record<string, { Icon: any; color: string; bg: string; label: string; bar: string }> = {
  text: { Icon: Type, color: '#5c7cfa', bg: 'rgba(92,124,250,0.1)', label: '文本', bar: 'type-text' },
  link: { Icon: ExternalLink, color: '#20c997', bg: 'rgba(32,201,151,0.1)', label: '链接', bar: 'type-link' },
  email: { Icon: Mail, color: '#f06595', bg: 'rgba(240,101,149,0.1)', label: '邮箱', bar: 'type-email' },
  color: { Icon: Hash, color: '#ff922b', bg: 'rgba(255,146,43,0.1)', label: '颜色', bar: 'type-color' },
  number: { Icon: Hash, color: '#fab005', bg: 'rgba(250,176,5,0.1)', label: '数字', bar: 'type-number' },
  code: { Icon: Code, color: '#845ef7', bg: 'rgba(132,94,247,0.1)', label: '代码', bar: 'type-code' },
  'long-text': { Icon: FileText, color: '#748ffc', bg: 'rgba(116,143,252,0.1)', label: '长文本', bar: 'type-long-text' },
}

const ClipboardItemCard: React.FC<Props> = memo(({ item, isSelected, onSelect }) => {
  const copyItem = useClipboardStore(s => s.copyItem)
  const deleteItem = useClipboardStore(s => s.deleteItem)
  const togglePin = useClipboardStore(s => s.togglePin)
  const copiedId = useClipboardStore(s => s.copiedId)
  const fontSize = useClipboardStore(s => s.settings.fontSize)

  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const cfg = TYPE_CFG[item.type] || TYPE_CFG.text
  const isCopied = copiedId === item.id

  const timeAgo = formatDistanceToNow(item.timestamp, { locale: zhCN, addSuffix: true })
  const truncated = item.content.length > 120 ? item.content.slice(0, 120) + '...' : item.content

  const onCopy = useCallback((e: React.MouseEvent) => { e.stopPropagation(); copyItem(item.id) }, [copyItem, item.id])
  const onDelete = useCallback((e: React.MouseEvent) => { e.stopPropagation(); deleteItem(item.id) }, [deleteItem, item.id])
  const onPin = useCallback((e: React.MouseEvent) => { e.stopPropagation(); togglePin(item.id) }, [togglePin, item.id])
  const onExpand = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setExpanded(v => !v) }, [])

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`glass-card rounded-xl overflow-hidden cursor-pointer h-full flex flex-col ${isSelected ? 'selected' : ''}`}
      style={{ willChange: 'transform' }}
    >
      <div className={`type-bar ${cfg.bar} w-full`} style={{ height: 2 }} />
      <div className="flex-1 flex items-start gap-3 p-3 overflow-hidden">
        {/* 类型图标 */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center relative"
          style={{ background: cfg.bg }}
        >
          <cfg.Icon size={16} color={cfg.color} />
          {item.pinned && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#fab005' }}>
              <Pin size={7} color="white" />
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: cfg.color, background: cfg.bg }}
            >
              {cfg.label}
            </span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{timeAgo}</span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>{item.content.length}字符</span>
          </div>

          <p
            className={`text-[13px] leading-relaxed break-all ${expanded ? '' : 'line-clamp-2'}`}
            style={{ color: 'rgba(255,255,255,0.65)', fontSize: fontSize - 2 }}
          >
            {expanded ? item.content : truncated}
          </p>

          {item.type === 'color' && (
            <div className="flex items-center gap-2 mt-2 p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="w-7 h-7 rounded" style={{ background: item.content, border: '1px solid rgba(255,255,255,0.1)' }} />
              <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.content}</span>
            </div>
          )}

          {item.type === 'link' && (
            <div className="mt-1.5 px-2 py-1 rounded" style={{ background: 'rgba(32,201,151,0.05)', border: '1px solid rgba(32,201,151,0.1)' }}>
              <span className="text-[11px] truncate block" style={{ color: 'rgba(32,201,151,0.7)' }}>{item.content}</span>
            </div>
          )}

          {item.type === 'code' && (
            <div className="mt-1.5 p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(132,94,247,0.1)' }}>
              <pre className="text-[11px] font-mono overflow-x-auto" style={{ color: 'rgba(132,94,247,0.6)' }}>
                <code>{item.content.slice(0, 150)}{item.content.length > 150 ? '...' : ''}</code>
              </pre>
            </div>
          )}

          {expanded && (
            <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <span>📝 {item.content.length} 字符</span>
              <span>📊 {item.content.split(/\s+/).filter(Boolean).length} 词</span>
              <span>📏 {item.content.split('\n').length} 行</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {hovered && (
          <div className="flex flex-col items-center gap-1 flex-shrink-0 fade-in">
            <button onClick={onCopy} className="action-btn copy" title="复制">
              {isCopied ? <Check size={13} color="#20c997" /> : <Copy size={13} />}
            </button>
            <button onClick={onPin} className={`action-btn pin ${item.pinned ? 'active' : ''}`} title={item.pinned ? '取消收藏' : '收藏'}>
              {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
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
          style={{ background: 'rgba(32,201,151,0.1)', backdropFilter: 'blur(4px)', borderRadius: 12 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(32,201,151,0.9)', boxShadow: '0 4px 12px rgba(32,201,151,0.3)' }}>
            <Check size={16} color="white" />
            <span className="text-sm font-medium text-white">已复制</span>
          </div>
        </div>
      )}

      {/* 选中指示 */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r" style={{ background: 'linear-gradient(to bottom, #748ffc, #4c6ef5)' }} />
      )}
    </div>
  )
})

ClipboardItemCard.displayName = 'ClipboardItemCard'
export default ClipboardItemCard
