import React, { useCallback, useMemo, useState } from 'react'
import { Copy, X, Pin, PinOff, Trash2, Heart, Check, ExternalLink, Mail, Hash, Code, FileText, Type, Pencil, Save, Minimize2, AlignLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import ImagePreview from './ImagePreview'
import TagInput from './TagInput'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const TYPE_CFG: Record<string, { Icon: LucideIcon; cssVar: string }> = {
  text: { Icon: Type, cssVar: 'var(--type-text)' },
  link: { Icon: ExternalLink, cssVar: 'var(--type-link)' },
  email: { Icon: Mail, cssVar: 'var(--type-email)' },
  color: { Icon: Hash, cssVar: 'var(--type-color)' },
  number: { Icon: Hash, cssVar: 'var(--type-number)' },
  code: { Icon: Code, cssVar: 'var(--type-code)' },
  json: { Icon: Code, cssVar: 'var(--type-code)' },
  markdown: { Icon: FileText, cssVar: 'var(--type-long-text)' },
  'long-text': { Icon: FileText, cssVar: 'var(--type-long-text)' },
  'file-path': { Icon: FileText, cssVar: 'var(--type-text)' },
  phone: { Icon: Hash, cssVar: 'var(--type-number)' },
  image: { Icon: FileText, cssVar: 'var(--type-long-text)' },
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

function compactJsonContent(content: string) {
  try {
    return JSON.stringify(JSON.parse(content))
  } catch {
    return content
  }
}

function normalizeCodeContent(content: string) {
  return content.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[ \t]+$/g, '')).join('\n')
}

function getLinkDetails(content: string) {
  try {
    const url = new URL(content.trim())
    const cleanUrl = new URL(url.toString())
    for (const key of [...cleanUrl.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid|dclid|msclkid)$/i.test(key)) cleanUrl.searchParams.delete(key)
    }
    return { host: url.hostname, cleanUrl: cleanUrl.toString(), changed: cleanUrl.toString() !== url.toString() }
  } catch {
    return null
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
  const deleteItems = useClipboardStore(s => s.deleteItems)
  const togglePin = useClipboardStore(s => s.togglePin)
  const toggleFavorite = useClipboardStore(s => s.toggleFavorite)
  const updateItemTags = useClipboardStore(s => s.updateItemTags)
  const updateItem = useClipboardStore(s => s.updateItem)
  const updateItemWorkspace = useClipboardStore(s => s.updateItemWorkspace)
  const notify = useClipboardStore(s => s.notify)
  const setDetailItemId = useClipboardStore(s => s.setDetailItemId)
  const { t, typeLabel, language } = useI18n()
  const [copiedHint, setCopiedHint] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [draftWorkspace, setDraftWorkspace] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const item = useMemo<ClipboardItem | undefined>(() => history.find(h => h.id === detailItemId), [history, detailItemId])

  React.useEffect(() => {
    if (!item) return
    setDraftContent(item.content)
    setDraftTags(item.tags || [])
    setDraftWorkspace(item.workspace || '')
    setEditing(false)
    setEditError('')
  }, [item?.id])

  const onClose = useCallback(() => setDetailItemId(null), [setDetailItemId])
  const onCopy = useCallback(() => { if (item) copyItem(item.id) }, [copyItem, item])
  const onPin = useCallback(() => { if (item) togglePin(item.id) }, [togglePin, item])
  const onFavorite = useCallback(() => { if (item) toggleFavorite(item.id) }, [toggleFavorite, item])
  const onDelete = useCallback(async () => {
    if (!item) return
    const count = await deleteItems([item.id])
    setDetailItemId(null)
    if (count > 0) notify(t('toast.deleted', { count }), 'success', 'undo-delete')
  }, [deleteItems, item, notify, setDetailItemId, t])

  const onSave = useCallback(async () => {
    if (!item || !draftContent.trim() || saving) return
    setSaving(true)
    setEditError('')
    try {
      await updateItem(item.id, draftContent, draftTags)
      setEditing(false)
      notify(t('toast.updated'), 'success')
    } catch (err) {
      console.error('updateItem failed:', err)
      setEditError(t('detail.updateFailed'))
    } finally {
      setSaving(false)
    }
  }, [draftContent, draftTags, item, notify, saving, t, updateItem])
  const onOpenLink = useCallback(() => {
    if (item?.type === 'link') window.electronAPI?.openExternalUrl(item.content)
  }, [item])
  const onOpenEmail = useCallback(() => {
    if (item?.type === 'email') window.electronAPI?.openExternalUrl(`mailto:${item.content.trim()}`)
  }, [item])
  const onShowFile = useCallback(() => {
    if (item?.type === 'file-path') window.electronAPI?.showFileInFolder(item.content)
  }, [item])
  const onSaveWorkspace = useCallback(async () => {
    if (!item) return
    try {
      await updateItemWorkspace(item.id, draftWorkspace)
    } catch (err) {
      console.error('updateItemWorkspace failed:', err)
    }
  }, [draftWorkspace, item, updateItemWorkspace])
  const onCopyText = useCallback((text: string, label = t('item.copied')) => {
    window.electronAPI?.copyToClipboard(text)
    setCopiedHint(label)
    window.setTimeout(() => setCopiedHint(null), 1200)
  }, [t])

  React.useEffect(() => {
    if (!detailItemId) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditingTarget = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false)
          setDraftContent(item?.content || '')
          setDraftTags(item?.tags || [])
        } else onClose()
      }
      if (editing && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void onSave()
      }
      if (!isEditingTarget && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && item) {
        e.preventDefault()
        copyItem(item.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copyItem, detailItemId, editing, item, onClose, onSave])

  if (!detailItemId) return null

  if (!item) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4 detail-backdrop" style={{ background: 'color-mix(in srgb, var(--bg-root) 72%, transparent)', backdropFilter: 'blur(10px)' }}>
        <div className="w-full max-w-sm rounded-lg p-5 text-center detail-panel" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card)' }}>
          <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>{t('detail.missing')}</p>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px]" style={{ background: 'var(--color-primary)', color: 'white' }}>{t('detail.close')}</button>
        </div>
      </div>
    )
  }

  const cfg = TYPE_CFG[item.type] || TYPE_CFG.text
  const isCopied = copiedId === item.id
  const typeBg = `color-mix(in srgb, ${cfg.cssVar} 8%, transparent)`
  const dateLocale = language === 'zh-CN' ? zhCN : enUS
  const createdAgo = formatDistanceToNow(item.firstTimestamp || item.timestamp, { locale: dateLocale, addSuffix: true })
  const updatedAgo = formatDistanceToNow(item.timestamp, { locale: dateLocale, addSuffix: true })
  const isCode = isVerificationCode(item.content)
  const displayContent = item.type === 'json' ? formatJsonContent(item.content) : item.content
  const colorVariants = item.type === 'color' ? getColorVariants(item.content) : null
  const linkDetails = item.type === 'link' ? getLinkDetails(item.content) : null
  const copyTimeline = [...new Set(item.copyTimestamps || [item.timestamp])].slice(0, 6)
  const timeFormatter = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="absolute inset-0 z-50 flex flex-col detail-panel" style={{ background: 'var(--bg-root)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-divider)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: typeBg }}>
            <cfg.Icon size={16} color={cfg.cssVar} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('detail.title')}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ color: cfg.cssVar, background: typeBg }}>{typeLabel(item.type)}</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{t('detail.updated', { time: updatedAgo })}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {item.type !== 'image' && !editing && <button onClick={() => setEditing(true)} className="action-btn" title={t('detail.edit')}><Pencil size={14} /></button>}
          <button onClick={onClose} className="action-btn" title={t('detail.close')}><X size={15} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 mb-3 slide-up">
          <DetailMeta label={t('detail.characters')} value={item.content.length} />
          <DetailMeta label={t('detail.lines')} value={item.content.split('\n').length} />
          <DetailMeta label={t('detail.words')} value={getWordCount(item.content)} />
          <DetailMeta label={t('detail.copies')} value={t('detail.copyTimes', { count: item.copyCount || 1 })} />
          <DetailMeta label={t('detail.firstRecorded')} value={createdAgo} />
          <DetailMeta label={t('detail.status')} value={`${item.pinned ? t('detail.pinned') : t('detail.unpinned')} · ${item.favorited ? t('detail.favorited') : t('detail.unfavorited')}`} />
        </div>

        <div className="mb-3 rounded-lg px-3 py-2.5 slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
          <div className="text-[10px] mb-2" style={{ color: 'var(--text-ghost)' }}>{t('tags.label')}</div>
          <TagInput value={editing ? draftTags : item.tags || []} onChange={tags => editing ? setDraftTags(tags) : updateItemTags(item.id, tags)} compact />
        </div>

        <div className="mb-3 rounded-lg px-3 py-2.5 slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
          <div className="text-[10px] mb-2" style={{ color: 'var(--text-ghost)' }}>{t('detail.workspace')}</div>
          <input value={draftWorkspace} onChange={event => setDraftWorkspace(event.target.value)} onBlur={() => void onSaveWorkspace()} placeholder={t('detail.workspacePlaceholder')} className="w-full rounded-md px-2.5 py-1.5 text-[12px] outline-none" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }} />
        </div>

        {copyTimeline.length > 1 && (
          <div className="mb-3 rounded-lg px-3 py-2.5 slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
            <div className="text-[10px] mb-2" style={{ color: 'var(--text-ghost)' }}>{t('detail.copyTimeline')}</div>
            <div className="flex flex-wrap gap-1.5">
              {copyTimeline.map(timestamp => <span key={timestamp} className="rounded px-1.5 py-1 text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)' }}>{timeFormatter.format(timestamp)}</span>)}
            </div>
          </div>
        )}

        {isCode && (
          <div className="mb-3 p-4 rounded-lg text-center slide-up" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 24%, transparent)' }}>
            <div className="text-[10px] mb-2" style={{ color: 'var(--color-warning)' }}>{t('detail.verificationTitle')}</div>
            <div className="text-[30px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{item.content.trim()}</div>
            <div className="text-[10px] mt-2" style={{ color: 'var(--text-ghost)' }}>{t('detail.autoExpire')}</div>
          </div>
        )}

        {item.type === 'color' && (
          <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg" style={{ background: item.content, border: '1px solid var(--border-card)' }} />
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{item.content}</span>
            </div>
            {colorVariants && (
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(colorVariants).map(([label, value]) => (
                  <button key={label} onClick={() => onCopyText(value, t('detail.copiedFormat', { format: label.toUpperCase() }))} className="p-2 rounded-lg text-left interactive-chip" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--text-ghost)' }}>{label}</div>
                    <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{value}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {item.type === 'link' && (
          <div className="mb-3 rounded-lg p-3 slide-up" style={{ background: 'color-mix(in srgb, var(--type-link) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--type-link) 18%, transparent)', color: 'var(--text-secondary)' }}>
            {linkDetails && <div className="mb-2 truncate text-[11px]" style={{ color: 'var(--type-link)' }}>{linkDetails.host}</div>}
            <div className="flex gap-2">
              <button onClick={onOpenLink} className="flex-1 rounded-md px-2.5 py-2 text-[11px] interactive-chip" style={{ background: 'var(--bg-elevated)' }}>{t('detail.openLink')}</button>
              {linkDetails?.changed && <button onClick={() => onCopyText(linkDetails.cleanUrl, t('detail.copiedCleanLink'))} className="flex-1 rounded-md px-2.5 py-2 text-[11px] interactive-chip" style={{ background: 'var(--bg-elevated)' }}>{t('detail.copyCleanLink')}</button>}
            </div>
          </div>
        )}

        {item.type === 'email' && (
          <button onClick={onOpenEmail} className="mb-3 w-full p-3 rounded-lg flex items-center justify-between interactive-chip slide-up" style={{ background: 'color-mix(in srgb, var(--type-email) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--type-email) 18%, transparent)', color: 'var(--text-secondary)' }}>
            <span className="text-[12px] truncate">{t('detail.mailTo', { email: item.content })}</span>
            <Mail size={14} />
          </button>
        )}

        {item.type === 'file-path' && (
          <button onClick={onShowFile} className="mb-3 w-full p-3 rounded-lg flex items-center justify-between interactive-chip slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)', color: 'var(--text-secondary)' }}>
            <span className="text-[12px] truncate">{t('detail.showFile')}</span>
            <FileText size={14} />
          </button>
        )}

        {item.type === 'image' && item.imagePath && (
          <div className="mb-3 p-3 rounded-lg slide-up" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
            <ImagePreview imagePath={item.imagePath} size="detail" />
            <div className="text-[10px] mt-2 break-all font-mono" style={{ color: 'var(--text-ghost)' }}>{item.imagePath}</div>
          </div>
        )}

        <div className="rounded-lg overflow-hidden slide-up" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card)', animationDelay: '80ms' }}>
          <div className="px-3 py-2 text-[10px] flex items-center justify-between" style={{ color: 'var(--text-ghost)', borderBottom: '1px solid var(--border-divider)' }}>
            <span>{t('detail.fullContent')}</span>
            <span>{t('item.chars', { count: editing ? draftContent.length : item.content.length })}</span>
          </div>
          {editing ? (
            <textarea autoFocus value={draftContent} onChange={event => setDraftContent(event.target.value)} className="min-h-[220px] w-full resize-none bg-transparent p-3 text-[12px] leading-relaxed outline-none" style={{ color: 'var(--text-primary)', fontFamily: item.type === 'code' || item.type === 'json' || item.type === 'markdown' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit' }} />
          ) : (
            <pre className="p-3 text-[12px] leading-relaxed whitespace-pre-wrap break-words max-h-[45vh] overflow-auto" style={{ color: 'var(--text-secondary)', fontFamily: item.type === 'code' || item.type === 'json' || item.type === 'markdown' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit' }}>{displayContent}</pre>
          )}
        </div>
        {editError && <p className="mt-2 text-[11px]" style={{ color: 'var(--color-danger)' }}>{editError}</p>}
      </div>

      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-divider)' }}>
        {editing ? (
          <>
            <button onClick={() => { setEditing(false); setDraftContent(item.content); setDraftTags(item.tags || []); setEditError('') }} className="h-10 flex-1 rounded-lg text-[12px] interactive-chip" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>{t('quickAdd.cancel')}</button>
            <button onClick={() => void onSave()} disabled={!draftContent.trim() || saving} className="h-10 flex-[1.6] rounded-lg text-[12px] font-medium flex items-center justify-center gap-2 disabled:opacity-40 interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}><Save size={14} />{saving ? t('detail.saving') : t('detail.save')}</button>
          </>
        ) : <button onClick={() => item.type === 'json' ? onCopyText(displayContent, t('detail.copiedFormat', { format: 'JSON' })) : onCopy()} className="flex-1 h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 interactive-chip" style={{ background: isCopied || copiedHint ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
            {isCopied || copiedHint ? <Check size={15} strokeWidth={3} /> : <Copy size={15} />}
            {copiedHint || (item.type === 'json' ? t('detail.copyJson') : isCopied ? t('item.copied') : t('detail.copyContent'))}
          </button>}
        {!editing && <>
        {item.type === 'json' && <button onClick={() => onCopyText(compactJsonContent(item.content), t('detail.copiedCompactJson'))} className="action-btn" title={t('detail.copyCompactJson')} style={{ width: 40, height: 40 }}><Minimize2 size={15} /></button>}
        {item.type === 'code' && <button onClick={() => onCopyText(normalizeCodeContent(item.content), t('detail.copiedNormalizedCode'))} className="action-btn" title={t('detail.copyNormalizedCode')} style={{ width: 40, height: 40 }}><AlignLeft size={15} /></button>}
        <button onClick={onPin} className={`action-btn pin ${item.pinned ? 'active' : ''}`} title={item.pinned ? t('item.unpin') : t('item.pin')} style={{ width: 40, height: 40 }}>
          {item.pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>
        <button onClick={onFavorite} className={`action-btn ${item.favorited ? 'active' : ''}`} title={item.favorited ? t('item.unfavorite') : t('item.favorite')} style={{ width: 40, height: 40, ...(item.favorited ? { color: '#f472b6', background: 'rgba(244,114,182,0.12)' } : {}) }}>
          <Heart size={15} fill={item.favorited ? '#f472b6' : 'none'} />
        </button>
        <button onClick={onDelete} className="action-btn delete" title={t('item.delete')} style={{ width: 40, height: 40 }}>
          <Trash2 size={15} />
        </button>
        </>}
      </div>
    </div>
  )
}

export default React.memo(ClipboardDetail)
