import { nativeImage } from 'electron'
import path from 'path'
import { createHash } from 'crypto'
import { normalizeTags } from '../../src/utils/clipboard'
import { isTextWithinLimit, getBoundedImportSource, isImportedItemsWithinBudget, MAX_HISTORY_TEXT_BYTES } from '../../src/utils/limits'
import { retainHistoryItems } from '../../src/utils/retention'
import { normalizeClipboardFilePaths } from '../../src/utils/fileClipboard'
import { sanitizeSettings } from './settingsService'
import { compileIgnoredRules } from '../../src/utils/ignoredRules'
import { clipboardTypes } from '../../src/types/clipboard'
import type { ClipboardItem, ClipboardType } from '../../src/types/clipboard'
import type { CreateItemResult, ImportHistoryResult, ImportMode } from '../../shared/ipc-contract'
import type { AppServices } from './index'

const CLIPBOARD_TYPES = clipboardTypes

const MAX_COPY_TIMESTAMPS = 20

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

export function getClipboardContentType(text: string): ClipboardType {
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) return 'link'
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) return 'email'
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed) || /^rgb/i.test(trimmed)) return 'color'
  if (/^(?:[a-z]:\\|\\\\|\/)[^<>:*?"|]+/i.test(trimmed)) return 'file-path'
  if (/^\+?\d[\d\s-]{6,}\d$/.test(trimmed) && trimmed.replace(/\D/g, '').length <= 18) return 'phone'
  if (/^[\d.,\s+*/()-]+$/.test(trimmed) && trimmed.length < 50) return 'number'
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return 'json' } catch {
      // 非法 JSON：继续按后续规则分类。
    }
  }
  if (/^#{1,6}\s|\n[-*]\s|```|\[[^\]]+\]\([^)]+\)/m.test(trimmed)) return 'markdown'
  if (/[{}[\]();]/.test(trimmed) && (trimmed.includes('function') || trimmed.includes('=>') || trimmed.includes('class') || trimmed.includes('import') || trimmed.includes('const ') || trimmed.includes('let ') || trimmed.includes('var '))) return 'code'
  if (trimmed.length > 100) return 'long-text'
  return 'text'
}

export function getClipboardFormatHash(content: string, html = '', rtf = '') {
  return createHash('sha256').update(`${content}\u0000${html}\u0000${rtf}`).digest('hex')
}

export function isImageHistoryItem(item: ClipboardItem | undefined): item is ClipboardItem & { imagePath: string } {
  return item?.type === 'image' && typeof item.imagePath === 'string' && item.imagePath.length > 0
}

/** 去除控制字符（\u0000-\u001f）：等价于原 /[\u0000-\u001f]/g，但避免 no-control-regex 误报。 */
function replaceControlChars(value: string, replacement: string) {
  return value.split('').map(ch => (ch.charCodeAt(0) < 0x20 ? replacement : ch)).join('')
}

export function normalizeWorkspace(value: unknown) {
  if (typeof value !== 'string') return undefined
  const workspace = replaceControlChars(value, ' ').replace(/\s+/g, ' ').trim().slice(0, 64)
  return workspace || undefined
}

export function normalizeSourceApplication(value: unknown) {
  if (typeof value !== 'string') return undefined
  const application = replaceControlChars(value, '').trim().replace(/\.exe$/i, '').slice(0, 120)
  return application || undefined
}

export interface HistoryService {
  generateId(): string
  getClipboardContentType(text: string): ClipboardType
  getClipboardFormatHash(content: string, html?: string, rtf?: string): string
  recordItemCopy(item: ClipboardItem, at?: number): void
  sanitizeHistoryItem(input: unknown, allowImagePath?: boolean): ClipboardItem | null
  dedupeHistory(items: ClipboardItem[]): ClipboardItem[]
  getImportedItemsWithinBudget(payload: unknown): ClipboardItem[] | null
  removeHistoryItems(shouldRemove: (item: ClipboardItem) => boolean, imageDeleteDelayMs?: number): ClipboardItem[]
  applyRetentionRules(): void
  copyToClipboard(itemOrContent: ClipboardItem | string, options?: { pasteAfterCopy?: unknown }): ClipboardItem[]
  createItem(draft: { content?: unknown; tags?: unknown; pinned?: unknown; favorited?: unknown }): CreateItemResult
  updateItemTags(id: string, tags: unknown): ClipboardItem[]
  updateItem(id: string, patch: { content?: unknown; tags?: unknown; workspace?: unknown }): ClipboardItem[]
  deleteItem(id: string): ClipboardItem[]
  deleteItems(ids: unknown): { history: ClipboardItem[]; deleted: ClipboardItem[] }
  restoreItems(items: unknown): ClipboardItem[]
  batchUpdateItems(ids: unknown, patch: { pinned?: unknown; favorited?: unknown; addTags?: unknown }): ClipboardItem[]
  togglePin(id: string): ClipboardItem[]
  toggleFavorite(id: string): ClipboardItem[]
  clearHistory(): ClipboardItem[]
  clearAllHistory(): ClipboardItem[]
  importHistory(payload: unknown, mode?: ImportMode): ImportHistoryResult
}

export function createHistoryService(services: AppServices): HistoryService {
  const rt = services.runtime

  function normalizeCopyTimestamps(input: unknown, fallbackTimestamp: number) {
    const timestamps = Array.isArray(input) ? input : []
    const seen = new Set<number>()
    for (const candidate of timestamps) {
      const value = Number(candidate)
      if (Number.isFinite(value) && value > 0) seen.add(Math.round(value))
    }
    seen.add(Math.round(fallbackTimestamp))
    return [...seen].sort((a, b) => b - a).slice(0, MAX_COPY_TIMESTAMPS)
  }

  function recordItemCopy(item: ClipboardItem, at = rt.now()) {
    item.timestamp = at
    item.copyCount = Math.max(1, item.copyCount || 1) + 1
    item.copyTimestamps = normalizeCopyTimestamps([at, ...(item.copyTimestamps || [])], at)
  }

  function sanitizeHistoryItem(input: unknown, allowImagePath = true): ClipboardItem | null {
    const item = input !== null && typeof input === 'object' ? input as Record<string, unknown> : null
    if (!item || typeof item.content !== 'string' || !item.content.trim() || !isTextWithinLimit(item.content)) return null
    const timestamp = Number(item.timestamp)
    const safeTimestamp = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : rt.now()
    const rawType = typeof item.type === 'string' ? item.type : getClipboardContentType(item.content)
    const type = (CLIPBOARD_TYPES as readonly string[]).includes(rawType) ? rawType as ClipboardType : getClipboardContentType(item.content)
    const html = typeof item.html === 'string' && isTextWithinLimit(item.html) ? item.html : undefined
    const rtf = typeof item.rtf === 'string' && isTextWithinLimit(item.rtf) ? item.rtf : undefined
    const imagePath = allowImagePath && typeof item.imagePath === 'string' ? services.image.resolveSafeImagePath(item.imagePath) : null
    const files = type === 'file-list' ? normalizeClipboardFilePaths(Array.isArray(item.files) ? item.files : item.content.split(/\r?\n/)) : []
    if (type === 'image' && !imagePath) return null
    if (type === 'file-list' && files.length === 0) return null
    return {
      // P2：id 一律由主进程重新生成，不信任外部数据（导入文件/渲染端传入）里的 id，
      // 避免伪造 id 顶替或覆盖已有条目。
      id: generateId(),
      content: item.content,
      html,
      rtf,
      type,
      timestamp: safeTimestamp,
      pinned: Boolean(item.pinned),
      favorited: Boolean(item.favorited),
      copyCount: Math.max(1, Number.isFinite(Number(item.copyCount)) ? Number(item.copyCount) : 1),
      firstTimestamp: Number.isFinite(Number(item.firstTimestamp)) ? Number(item.firstTimestamp) : safeTimestamp,
      imagePath: imagePath || undefined,
      files: files.length > 0 ? files : undefined,
      tags: normalizeTags(item.tags),
      copyTimestamps: normalizeCopyTimestamps(item.copyTimestamps, safeTimestamp),
      workspace: normalizeWorkspace(item.workspace),
      workspaceManual: Boolean(item.workspaceManual),
      sourceApplication: normalizeSourceApplication(item.sourceApplication),
    }
  }

  function getHistoryDedupeKey(item: ClipboardItem) {
    return `${item.type}:${item.content}:${item.html || ''}:${item.rtf || ''}:${(item.files || []).join('\0')}`
  }

  function dedupeHistory(items: ClipboardItem[]) {
    const byContent = new Map<string, ClipboardItem>()
    for (const item of items.sort((a, b) => b.timestamp - a.timestamp)) {
      const key = getHistoryDedupeKey(item)
      const existing = byContent.get(key)
      if (!existing) {
        byContent.set(key, { ...item })
        continue
      }
      existing.pinned = existing.pinned || item.pinned
      existing.favorited = existing.favorited || item.favorited
      existing.copyCount = Math.max(existing.copyCount || 1, item.copyCount || 1)
      existing.firstTimestamp = Math.min(existing.firstTimestamp || existing.timestamp, item.firstTimestamp || item.timestamp)
      if (!existing.imagePath && item.imagePath) existing.imagePath = item.imagePath
      existing.tags = normalizeTags([...existing.tags || [], ...item.tags || []])
      existing.copyTimestamps = normalizeCopyTimestamps([...existing.copyTimestamps || [], ...item.copyTimestamps || []], existing.timestamp)
      if (!existing.workspace || (!existing.workspaceManual && item.workspaceManual)) {
        existing.workspace = item.workspace
        existing.workspaceManual = item.workspaceManual
      }
      if (!existing.sourceApplication && item.sourceApplication) existing.sourceApplication = item.sourceApplication
    }
    return Array.from(byContent.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  /** 导入前按 text/html/rtf 累计全部条目字节，超出落盘预算则整批拒绝（P2 聚合预算）。 */
  function getImportedItemsWithinBudget(payload: unknown): ClipboardItem[] | null {
    const source = getBoundedImportSource(payload)
    if (!isImportedItemsWithinBudget(source as never)) return null
    return source
      .map(item => sanitizeHistoryItem(item, false))
      .filter(Boolean) as ClipboardItem[]
  }

  function removeHistoryItems(shouldRemove: (item: ClipboardItem) => boolean, imageDeleteDelayMs = 0) {
    const removed: ClipboardItem[] = []
    rt.history = rt.history.filter(item => {
      if (shouldRemove(item)) {
        removed.push(item)
        return false
      }
      return true
    })
    removed.forEach(item => services.image.scheduleImageDelete(item.imagePath, imageDeleteDelayMs))
    return removed
  }

  function applyRetentionRules() {
    const nextHistory = retainHistoryItems(rt.history, {
      maxHistory: rt.settings.maxHistory,
      autoDeleteDays: rt.settings.autoDeleteDays,
      verificationCodeTtlMinutes: rt.settings.verificationCodeTtlMinutes,
      maxTextBytes: MAX_HISTORY_TEXT_BYTES,
    })
    const nextIds = new Set(nextHistory.map(item => item.id))
    const removedImages = rt.history
      .filter(item => !nextIds.has(item.id))
      .map(item => item.imagePath)
    rt.history = nextHistory
    removedImages.forEach(imagePath => services.image.safeDeleteImageFile(imagePath))
  }

  function copyToClipboard(itemOrContent: ClipboardItem | string, options?: { pasteAfterCopy?: unknown }) {
    const pasteAfterCopy = options?.pasteAfterCopy === true && rt.settings.quickPaste
    const finishCopy = () => {
      if (pasteAfterCopy) {
        const target = rt.quickPasteTarget ? { ...rt.quickPasteTarget } : null
        rt.quickPasteTarget = null
        services.window.hideMainWindow()
        setTimeout(() => services.quickPaste.sendTargetedPaste(target), 80)
      } else if (rt.settings.hideAfterCopy) {
        rt.quickPasteTarget = null
        services.window.hideMainWindow()
      }
    }

    if (typeof itemOrContent === 'string') {
      if (!isTextWithinLimit(itemOrContent)) throw new Error('Clipboard item is too large')
      services.clipboard.writeText(itemOrContent)
      rt.lastClipboardContent = itemOrContent
      rt.lastClipboardFormatHash = getClipboardFormatHash(itemOrContent)
      finishCopy()
      return rt.history
    }

    const historyItem = rt.history.find(item => item.id === itemOrContent.id)
    const item = historyItem || sanitizeHistoryItem(itemOrContent, true)
    if (!item) return rt.history
    const safeImagePath = isImageHistoryItem(item) ? services.image.resolveSafeImagePath(item.imagePath) : null

    if (safeImagePath && services.runtime.ports.fs.exists(safeImagePath)) {
      const imageBytes = services.image.readImageFile(safeImagePath)
      const image = imageBytes ? nativeImage.createFromBuffer(imageBytes) : nativeImage.createEmpty()
      if (!image.isEmpty()) {
        services.clipboard.writeImage(image)
        rt.lastClipboardImageHash = path.basename(safeImagePath, path.extname(safeImagePath))
        rt.lastImageCheckAt = rt.now()
      } else {
        services.clipboard.write({ text: item.content, ...(item.html ? { html: item.html } : {}), ...(item.rtf ? { rtf: item.rtf } : {}) })
        rt.lastClipboardContent = item.content
        rt.lastClipboardFormatHash = getClipboardFormatHash(item.content, item.html, item.rtf)
      }
    } else {
      services.clipboard.write({ text: item.content, ...(item.html ? { html: item.html } : {}), ...(item.rtf ? { rtf: item.rtf } : {}) })
      rt.lastClipboardContent = item.content
      rt.lastClipboardFormatHash = getClipboardFormatHash(item.content, item.html, item.rtf)
    }

    if (historyItem) {
      const historyIndex = rt.history.findIndex(entry => entry.id === historyItem.id)
      if (historyIndex >= 0) rt.history.splice(historyIndex, 1)
      recordItemCopy(historyItem)
      rt.history.unshift(historyItem)
      services.storage.scheduleSave()
      rt.sendToRenderer('history-updated', rt.history)
    }
    finishCopy()
    return rt.history
  }

  function createItem(draft: { content?: unknown; tags?: unknown; pinned?: unknown; favorited?: unknown }): CreateItemResult {
    const content = typeof draft?.content === 'string' ? draft.content : ''
    if (!content.trim()) return { history: rt.history, itemId: null, created: false }
    if (!isTextWithinLimit(content)) throw new Error('Clipboard item is too large')

    const tags = normalizeTags(draft.tags)
    const existingIndex = rt.history.findIndex(item => item.type !== 'image' && item.content === content)
    let item: ClipboardItem
    let created = false

    if (existingIndex >= 0) {
      item = rt.history.splice(existingIndex, 1)[0]
      recordItemCopy(item)
      item.tags = normalizeTags([...(item.tags || []), ...tags])
      item.pinned = item.pinned || Boolean(draft.pinned)
      item.favorited = item.favorited || Boolean(draft.favorited)
    } else {
      const now = rt.now()
      item = {
        id: generateId(),
        content,
        type: getClipboardContentType(content),
        timestamp: now,
        firstTimestamp: now,
        copyCount: 1,
        pinned: Boolean(draft.pinned),
        favorited: Boolean(draft.favorited),
        tags,
        copyTimestamps: [now],
      }
      created = true
    }

    rt.history.unshift(item)
    applyRetentionRules()
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return { history: rt.history, itemId: item.id, created }
  }

  function updateItemTags(id: string, tags: unknown) {
    const item = rt.history.find(entry => entry.id === id)
    if (!item) return rt.history
    item.tags = normalizeTags(tags)
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function updateItem(id: string, patch: { content?: unknown; tags?: unknown; workspace?: unknown }) {
    const item = rt.history.find(entry => entry.id === id)
    if (!item || item.type === 'image') return rt.history

    if (typeof patch?.content === 'string') {
      if (!patch.content.trim()) throw new Error('Clipboard item cannot be empty')
      if (!isTextWithinLimit(patch.content)) throw new Error('Clipboard item is too large')
      item.content = patch.content
      item.html = undefined
      item.rtf = undefined
      item.type = getClipboardContentType(patch.content)
      item.timestamp = rt.now()
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'tags')) item.tags = normalizeTags(patch.tags)
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'workspace')) {
      item.workspace = normalizeWorkspace(patch.workspace)
      item.workspaceManual = Boolean(item.workspace)
    }

    rt.history = dedupeHistory(rt.history)
    applyRetentionRules()
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function deleteItem(id: string) {
    removeHistoryItems(item => item.id === id)
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function deleteItems(ids: unknown) {
    const safeIds = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').slice(0, 500) : [])
    const deleted = removeHistoryItems(item => safeIds.has(item.id), 8000)
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return { history: rt.history, deleted }
  }

  function restoreItems(items: unknown) {
    const restored = (Array.isArray(items) ? items : [])
      .slice(0, 500)
      .map(item => sanitizeHistoryItem(item))
      .filter(Boolean) as ClipboardItem[]
    if (restored.length === 0) return rt.history
    restored.forEach(item => services.image.cancelImageDelete(item.imagePath))
    rt.history = dedupeHistory([...restored, ...rt.history])
    applyRetentionRules()
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function batchUpdateItems(ids: unknown, patch: { pinned?: unknown; favorited?: unknown; addTags?: unknown }) {
    const safeIds = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').slice(0, 500) : [])
    const tags = normalizeTags(patch?.addTags)
    for (const item of rt.history) {
      if (!safeIds.has(item.id)) continue
      if (typeof patch?.pinned === 'boolean') item.pinned = patch.pinned
      if (typeof patch?.favorited === 'boolean') item.favorited = patch.favorited
      if (tags.length > 0) item.tags = normalizeTags([...(item.tags || []), ...tags])
    }
    applyRetentionRules()
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function togglePin(id: string) {
    const item = rt.history.find(entry => entry.id === id)
    if (item) {
      item.pinned = !item.pinned
      applyRetentionRules()
    }
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function toggleFavorite(id: string) {
    const item = rt.history.find(entry => entry.id === id)
    if (item) {
      item.favorited = !item.favorited
      applyRetentionRules()
    }
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function clearHistory() {
    removeHistoryItems(item => !item.pinned && !item.favorited)
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function clearAllHistory() {
    removeHistoryItems(() => true)
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return rt.history
  }

  function importHistory(payload: unknown, mode: ImportMode = 'merge'): ImportHistoryResult {
    const imported = getImportedItemsWithinBudget(payload)
    if (!imported) throw new Error('Import batch exceeds the persisted data budget')
    if (imported.length === 0) return { history: rt.history, imported: 0 }

    if (mode === 'replace') {
      rt.history = dedupeHistory(imported)
    } else {
      rt.history = dedupeHistory([...imported, ...rt.history])
    }

    const payloadRecord = payload !== null && typeof payload === 'object' ? payload as Record<string, unknown> : null
    if (payloadRecord?.settings && typeof payloadRecord.settings === 'object') {
      const oldSettings = rt.settings
      const nextSettings = {
        ...sanitizeSettings({ ...rt.settings, ...(payloadRecord.settings as Partial<typeof rt.settings>) }),
        hotkey: oldSettings.hotkey,
        searchHotkey: oldSettings.searchHotkey,
        clearHotkey: oldSettings.clearHotkey,
      }
      rt.settings = nextSettings
      rt.ignoredRules = compileIgnoredRules(rt.settings.ignoredPatterns)
      services.privacy.rebuildMatcher()
      services.settings.applyAutoStart()
      rt.sendToRenderer('settings-updated', rt.settings)
    }

    applyRetentionRules()
    rt.sendToRenderer('history-updated', rt.history)
    services.storage.scheduleSave()
    return { history: rt.history, imported: imported.length }
  }

  return {
    generateId,
    getClipboardContentType,
    getClipboardFormatHash,
    recordItemCopy,
    sanitizeHistoryItem,
    dedupeHistory,
    getImportedItemsWithinBudget,
    removeHistoryItems,
    applyRetentionRules,
    copyToClipboard,
    createItem,
    updateItemTags,
    updateItem,
    deleteItem,
    deleteItems,
    restoreItems,
    batchUpdateItems,
    togglePin,
    toggleFavorite,
    clearHistory,
    clearAllHistory,
    importHistory,
  }
}
