import React, { useCallback, useMemo, useState } from 'react'
import { Copy, X, Pin, PinOff, Trash2, Heart, Check, ExternalLink, Mail, Hash, Code, FileText, Type } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import ImagePreview from './ImagePreview'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'

const TYPE_CFG: Record<string, { Icon: any; label: string; cssVar: string }> = {
  text: { Icon: Type, label: '文本', cssVar: 'var(--type-text)' },
  link: { Icon: ExternalLink, label: '链接', cssVar: 'var(--type-link)' },
  email: { Icon: Mail, label: '邮箱', cssVar: 'var(--type-email)' },
  color: { Icon: Hash, label: '颜色', cssVar: 'var(--type-color)' },
  number: { Icon: Hash, label: '数字', cssVar: 'var(--type-number)' },
  code: { Icon: Code, label: '代码', cssVar: 'var(--type-code)' },
  json: { Icon: Code, label: 'JSON', cssVar: 'var(--type-code)' },
  markdown: { Icon: FileText, label: 'Markdown', cssVar: 'var(--type-long-text)' },
  'long-text': { Icon: FileText, label: '长文本', cssVar: 'var(--type-long-text)' },
  'file-path': { Icon: FileText, label: '路径', cssVar: 'var(--type-text)' },
  phone: { Icon: Hash, label: '电话', cssVar: 'var(--type-number)' },
  image: { Icon: FileText, label: '图片', cssVar: 'var(--type-long-text)' },
}

function isVerificationCode(content: string) {
  return /^\d{4,8}$/.test(content.trim())
}

function formatJsonContent(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

function getColorVariants(content: string) {
  const value = content.trim()
  let r = 0, g = 0, b = 0
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    r = parseInt(value[1] + value[1], 16)
    g = parseInt(value[2] + value[2], 16)
    b = parseInt(value[3] + value[3], 16)
  } else if (/^#[0-9a-f]{6}$/i.test(value)) {
    r = parseInt(value.slice(1, 3), 16)
    g = parseInt(value.slice(3, 5), 16)
    b = parseInt(value.slice(5, 7), 16)
  } else {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
    if (!match) return null
    r = Number(match[1]); g = Number(match[2]); b = Number(match[3])
  }
  const hex = `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
  return { hex, rgb: `rgb(${r}, ${g}, ${b})`, cssVar: `--color: ${hex};` }
}

function getWordCount(content: string) {
  return content.split(/\s+/).filter(Boolean).length
}

interface DetailMetaProps {
  label: string
  value: React.ReactNode
}

const DetailMeta: React.FC<DetailMetaProps> = ({ label, value }) => (
  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
    <div className="text-[10px] mb-1" style={{ color: 'var(--text-ghost)' }}>{label}</div>
    <div className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{value}</div>
  </div>
)

const ClipboardDetail: React.FC = () => {
  const detailItemId = useClipboardStore(s => s.detailItemId)
  const history = useClipboardStore(s => s.history)
  const copiedId = useClipboardStore(s => s.copiedId)
  const copyItem = useClipboardStore(s => s.copyItem)
  const deleteItem = useClipboardStore(s => s.deleteItem)
  const togglePin = useClipboardStore(s => s.togglePin)
  const toggleFavorite = useClipboardStore(s => s.toggleFavorite)
  const setDetailItemId = useClipboardStore(s => s.setDetailItemId)
  const [copiedHint, setCopiedHint] = useState<string | null>(null)

  const item = useMemo<ClipboardItem | undefined>(() => history.find(h => h.id === detailItemId), [history, detailItemId])

  const onClose = useCallback(() => setDetailItemId(null), [setDetailItemId])
  const onCopy = useCallback(() => { if (item) copyItem(item.id) }, [copyItem, item])
  const onPin = useCallback(() => { if (item) togglePin(item.id) }, [togglePin, item])
  const onFavorite = useCallback(() => { if (item) toggleFavorite(item.id) }, [toggleFavorite, item])
  const onDelete = useCallback(async () => {
    if (!item) return
    await deleteItem(item.id)
    setDetailItemId(null)
  }, [deleteItem, item, setDetailItemId])
  const onOpenLink = useCallback(() => {
    if (item?.type === 'link') window.electronAPI?.openExternalUrl(item.content)
  }, [item])
  const onOpenEmail = useCallback(() => {
    if (item?.type === 'email') window.electronAPI?.openExternalUrl(`mailto:${item.content.trim()}`)
  }, [item])
  const onShowFile = useCallback(() => {
    if (item?.type === 'file-path') window.electronAPI?.showFileInFolder(item.content)
  }, [item])
  const onCopyText = useCallback((text: string, label = '已复制') => {
    window.electronAPI?.copyToClipboard(text)
    setCopiedHint(label)
    window.setTimeout(() => setCopiedHint(null), 1200)
  }, [])

  React.useEffect(() => {
    if (!detailItemId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && item) {
        e.preventDefault()
        copyItem(item.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copyItem, detailItemId, item, onClose])

  if (!detailItemId) return null

  if (!item) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4 detail-backdrop" style={{ background: 'color-mix(in srgb, var(--bg-root) 72%, transparent)', backdropFilter: 'blur(10px)' }}>
        <div className="w-full max-w-sm rounded-2xl p-5 text-center detail-panel" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card)' }}>
          <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>该剪贴板记录已不存在</p>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px]" style={{ background: 'var(--color-primary)', color: 'white' }}>关闭</button>
        </div>
      </div>
    )
  }

  const cfg = TYPE_CFG[item.type] || TYPE_CFG.text
  const isCopied = copiedId === item.id
  const typeBg = `color-mix(in srgb, ${cfg.cssVar} 8%, transparent)`
  const createdAgo = formatDistanceToNow(item.firstTimestamp || item.timestamp, { locale: zhCN, addSuffix: true })
  const updatedAgo = formatDistanceToNow(item.timestamp, { locale: zhCN, addSuffix: true })
  const isCode = isVerificationCode(item.content)
  const displayContent = item.type === 'json' ? formatJsonContent(item.content) : item.content
  const colorVariants = item.type === 'color' ? getColorVariants(item.content) : null

  return (
    <div className="absolute inset-0 z-50 flex flex-col detail-panel" style={{ background: 'var(--bg-root)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-divider)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: typeBg }}>
            <cfg.Icon size={16} color={cfg.cssVar} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>剪贴板详情</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ color: cfg.cssVar, background: typeBg }}>{cfg.label}</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>更新于 {updatedAgo}</div>
          </div>
        </div>
        <button onClick={onClose} className="action-btn" title="关闭详情">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 mb-3 slide-up">
          <DetailMeta label="字符" value={item.content.length} />
          <DetailMeta label="行数" value={item.content.split('\n').length} />
          <DetailMeta label="词数" value={getWordCount(item.content)} />
          <DetailMeta label="复制" value={`${item.copyCount || 1} 次`} />
          <DetailMeta label="首次记录" value={createdAgo} />
          <DetailMeta label="状态" value={`${item.pinned ? '已置顶' : '未置顶'} · ${item.favorited ? '已收藏' : '未收藏'}`} />
        </div>

        {isCode && (
          <div className="mb-3 p-4 rounded-xl text-center slide-up" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 24%, transparent)' }}>
            <div className="text-[10px] mb-2" style={{ color: 'var(--color-warning)' }}>验证码 / 临时数字</div>
            <div className="text-[30px] font-bold tracking-[0.28em]" style={{ color: 'var(--text-primary)' }}>{item.content.trim()}</div>
            <div className="text-[10px] mt-2" style={{ color: 'var(--text-ghost)' }}>会按设置自动过期清理</div>
          </div>
        )}

        {item.type === 'color' && (
          <div className="mb-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg" style={{ background: item.content, border: '1px solid var(--border-card)' }} />
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{item.content}</span>
            </div>
            {colorVariants && (
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(colorVariants).map(([label, value]) => (
                  <button key={label} onClick={() => onCopyText(value, `已复制 ${label.toUpperCase()}`)} className="p-2 rounded-lg text-left interactive-chip" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--text-ghost)' }}>{label}</div>
                    <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{value}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {item.type === 'link' && (
          <button onClick={onOpenLink} className="mb-3 w-full p-3 rounded-xl flex items-center justify-between interactive-chip slide-up" style={{ background: 'color-mix(in srgb, var(--type-link) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--type-link) 18%, transparent)', color: 'var(--text-secondary)' }}>
            <span className="text-[12px] truncate">在浏览器打开链接</span>
            <ExternalLink size={14} />
          </button>
        )}

        {item.type === 'email' && (
          <button onClick={onOpenEmail} className="mb-3 w-full p-3 rounded-xl flex items-center justify-between interactive-chip slide-up" style={{ background: 'color-mix(in srgb, var(--type-email) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--type-email) 18%, transparent)', color: 'var(--text-secondary)' }}>
            <span className="text-[12px] truncate">写邮件给 {item.content}</span>
            <Mail size={14} />
          </button>
        )}

        {item.type === 'file-path' && (
          <button onClick={onShowFile} className="mb-3 w-full p-3 rounded-xl flex items-center justify-between interactive-chip slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)', color: 'var(--text-secondary)' }}>
            <span className="text-[12px] truncate">打开所在位置</span>
            <FileText size={14} />
          </button>
        )}

        {item.type === 'image' && item.imagePath && (
          <div className="mb-3 p-3 rounded-xl slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
            <ImagePreview imagePath={item.imagePath} size="detail" />
            <div className="text-[10px] mt-2 break-all font-mono" style={{ color: 'var(--text-ghost)' }}>{item.imagePath}</div>
          </div>
        )}

        <div className="rounded-xl overflow-hidden slide-up" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card)', animationDelay: '80ms' }}>
          <div className="px-3 py-2 text-[10px] flex items-center justify-between" style={{ color: 'var(--text-ghost)', borderBottom: '1px solid var(--border-divider)' }}>
            <span>完整内容</span>
            <span>{item.content.length} 字符</span>
          </div>
          <pre className="p-3 text-[12px] leading-relaxed whitespace-pre-wrap break-words max-h-[45vh] overflow-auto" style={{ color: 'var(--text-secondary)', fontFamily: item.type === 'code' || item.type === 'json' || item.type === 'markdown' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit' }}>
            {displayContent}
          </pre>
        </div>
      </div>

      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-divider)' }}>
        <button onClick={() => item.type === 'json' ? onCopyText(displayContent, '已复制格式化 JSON') : onCopy()} className="flex-1 h-10 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 interactive-chip" style={{ background: isCopied || copiedHint ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {isCopied || copiedHint ? <Check size={15} strokeWidth={3} /> : <Copy size={15} />}
          {copiedHint || (item.type === 'json' ? '复制格式化 JSON' : isCopied ? '已复制' : '复制内容')}
        </button>
        <button onClick={onPin} className={`action-btn pin ${item.pinned ? 'active' : ''}`} title={item.pinned ? '取消置顶' : '置顶'} style={{ width: 40, height: 40 }}>
          {item.pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>
        <button onClick={onFavorite} className={`action-btn ${item.favorited ? 'active' : ''}`} title={item.favorited ? '取消收藏' : '收藏'} style={{ width: 40, height: 40, ...(item.favorited ? { color: '#f472b6', background: 'rgba(244,114,182,0.12)' } : {}) }}>
          <Heart size={15} fill={item.favorited ? '#f472b6' : 'none'} />
        </button>
        <button onClick={onDelete} className="action-btn delete" title="删除" style={{ width: 40, height: 40 }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

export default React.memo(ClipboardDetail)
