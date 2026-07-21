import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, CheckSquare, Clock3, Download, MoreHorizontal, Sparkles, Star, Trash2, Upload, X } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'
import { createTextMetadataBackup } from '../utils/backup'
import { getBoundedImportSource, MAX_IMPORT_FILE_BYTES } from '../utils/limits'
import ConfirmDialog from './ConfirmDialog'

type ClearMode = 'kept' | 'all' | null

const TabBar: React.FC = memo(() => {
  const activeTab = useClipboardStore(s => s.activeTab)
  const setActiveTab = useClipboardStore(s => s.setActiveTab)
  const clearHistory = useClipboardStore(s => s.clearHistory)
  const clearAllHistory = useClipboardStore(s => s.clearAllHistory)
  const importHistory = useClipboardStore(s => s.importHistory)
  const history = useClipboardStore(s => s.history)
  const settings = useClipboardStore(s => s.settings)
  const selectionMode = useClipboardStore(s => s.selectionMode)
  const setSelectionMode = useClipboardStore(s => s.setSelectionMode)
  const notify = useClipboardStore(s => s.notify)
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [clearMode, setClearMode] = useState<ClearMode>(null)
  const [importPayload, setImportPayload] = useState<unknown>(null)
  const [importCount, setImportCount] = useState(0)

  const favoriteCount = useMemo(() => history.filter(item => item.favorited).length, [history])
  const tabs = useMemo(() => [
    { id: 'history' as const, label: t('tabs.history'), Icon: Clock3, count: history.length },
    { id: 'favorites' as const, label: t('tabs.favorites'), Icon: Star, count: favoriteCount },
    { id: 'stats' as const, label: t('tabs.stats'), Icon: BarChart3, count: null },
  ], [favoriteCount, history.length, t])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const onExport = useCallback(() => {
    const backup = createTextMetadataBackup(history, settings)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a')
    const url = URL.createObjectURL(blob)
    anchor.href = url
    anchor.download = `clipmaster-text-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify(t('toast.exported'), 'success')
    setMenuOpen(false)
  }, [history, notify, settings, t])

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error('Import file exceeds the safety limit')
      const payload = JSON.parse(await file.text())
      const source = getBoundedImportSource(payload)
      if (source.length === 0) throw new Error('No records')
      setImportPayload(payload)
      setImportCount(source.length)
    } catch (err) {
      console.error('Import failed:', err)
      notify(file.size > MAX_IMPORT_FILE_BYTES ? t('tabs.importTooLarge') : t('tabs.importFailed'), 'danger')
    }
  }, [notify, t])

  const applyImport = useCallback(async (mode: 'merge' | 'replace') => {
    const count = await importHistory(importPayload, mode)
    setImportPayload(null)
    setImportCount(0)
    notify(count > 0 ? t('tabs.imported', { count }) : t('tabs.importEmpty'), count > 0 ? 'success' : 'warning')
  }, [importHistory, importPayload, notify, t])

  const onSmartOrganize = useCallback(async () => {
    const recent = history.slice(0, 20).map(item => item.content.trim()).filter(Boolean)
    const unique = Array.from(new Set(recent))
    if (unique.length === 0) {
      notify(t('tabs.organizeEmpty'), 'warning')
      return
    }
    const allLinks = unique.every(item => /^https?:\/\//i.test(item))
    const result = allLinks ? unique.map(item => `- ${item}`).join('\n') : unique.map((item, index) => `${index + 1}. ${item}`).join('\n')
    await window.electronAPI?.copyToClipboard(`# ${t('tabs.organizeTitle')}\n\n${result}`)
    notify(t('tabs.organized', { count: unique.length }), 'success')
    setMenuOpen(false)
  }, [history, notify, t])

  const confirmClear = useCallback(async () => {
    if (clearMode === 'all') await clearAllHistory()
    else if (clearMode === 'kept') await clearHistory()
    if (clearMode) notify(clearMode === 'all' ? t('toast.clearedAll') : t('toast.clearedKept'), 'success')
    setClearMode(null)
  }, [clearAllHistory, clearHistory, clearMode, notify, t])

  return (
    <>
      <div className="relative flex h-10 items-center justify-between border-b px-3" style={{ borderColor: 'var(--border-divider)' }}>
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-btn ${active ? 'active' : ''}`}>
                <tab.Icon size={13} strokeWidth={active ? 2.5 : 2} />
                <span>{tab.label}</span>
                {tab.count !== null && <span className="tab-count">{tab.count}</span>}
              </button>
            )
          })}
        </div>
        <div className="relative flex flex-shrink-0 items-center gap-0.5" ref={menuRef}>
          {activeTab !== 'stats' && (
            <button onClick={() => setSelectionMode(!selectionMode)} className={`action-btn ${selectionMode ? 'active' : ''}`} title={t('tabs.select')}><CheckSquare size={13} /></button>
          )}
          <button onClick={() => setMenuOpen(value => !value)} className={`action-btn ${menuOpen ? 'active' : ''}`} title={t('tabs.more')}><MoreHorizontal size={14} /></button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
          {menuOpen && (
            <div className="absolute right-0 top-9 z-40 w-52 overflow-hidden rounded-md p-1 shadow-xl fade-in" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-card-hover)', backdropFilter: 'blur(18px)' }}>
              <button onClick={() => void onSmartOrganize()} className="menu-item"><Sparkles size={13} />{t('tabs.organize')}</button>
              <button onClick={() => { fileInputRef.current?.click(); setMenuOpen(false) }} className="menu-item"><Upload size={13} />{t('tabs.import')}</button>
              <button onClick={onExport} className="menu-item"><Download size={13} />{t('tabs.export')}</button>
              {history.length > 0 && <div className="my-1 h-px" style={{ background: 'var(--border-divider)' }} />}
              {history.length > 0 && <button onClick={() => { setClearMode('kept'); setMenuOpen(false) }} className="menu-item danger"><Trash2 size={13} />{t('tabs.clearKept')}</button>}
              {history.length > 0 && <button onClick={() => { setClearMode('all'); setMenuOpen(false) }} className="menu-item danger"><X size={13} />{t('tabs.clearAllTitle')}</button>}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={clearMode !== null}
        title={clearMode === 'all' ? t('tabs.clearAllTitle') : t('tabs.clearKeptTitle')}
        description={clearMode === 'all' ? t('tabs.clearAllConfirm') : t('tabs.clearKeptConfirm')}
        confirmLabel={t('tabs.confirmClear')}
        cancelLabel={t('quickAdd.cancel')}
        danger
        onConfirm={() => void confirmClear()}
        onCancel={() => setClearMode(null)}
      />

      {importPayload !== null && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center p-4 detail-backdrop" style={{ background: 'color-mix(in srgb, var(--bg-root) 76%, transparent)', backdropFilter: 'blur(12px)' }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm overflow-hidden rounded-lg detail-panel" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-app)' }}>
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ color: 'var(--color-primary-light)', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}><Upload size={15} /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tabs.importTitle')}</h2>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{t('tabs.importPreview', { count: importCount })}</p>
              </div>
              <button onClick={() => setImportPayload(null)} className="action-btn" title={t('quickAdd.cancel')}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <button onClick={() => void applyImport('merge')} className="rounded-md p-3 text-left interactive-chip" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
                <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tabs.importMerge')}</span>
                <span className="mt-1 block text-[10px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{t('tabs.importMergeDesc')}</span>
              </button>
              <button onClick={() => void applyImport('replace')} className="rounded-md p-3 text-left interactive-chip" style={{ background: 'color-mix(in srgb, var(--color-warning) 7%, var(--bg-surface))', border: '1px solid color-mix(in srgb, var(--color-warning) 18%, var(--border-card))' }}>
                <span className="block text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>{t('tabs.importReplace')}</span>
                <span className="mt-1 block text-[10px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{t('tabs.importReplaceDesc')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

TabBar.displayName = 'TabBar'
export default TabBar
