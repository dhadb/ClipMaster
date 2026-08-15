import { app, BrowserWindow, Tray, Menu, clipboard, globalShortcut, nativeImage, ipcMain, screen, shell, net, safeStorage, type IpcMainInvokeEvent } from 'electron'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { normalizeTags } from '../src/utils/clipboard'
import { compareVersions } from '../src/utils/version'
import { parseClipMasterReleaseApiPayload, parseClipMasterReleasePage, parseClipMasterReleaseUrl, parseReleaseChecksum } from '../src/utils/update'
import { getLocalDateKey, normalizeDailyCounter } from '../src/utils/dailyCounter'
import { compileIgnoredRules, matchesIgnoredRules, normalizeIgnoredPatterns, type CompiledIgnoredRule } from '../src/utils/ignoredRules'
import { isSensitiveClipboardContent } from '../src/utils/privacy'
import { isResolvedPathInside } from '../src/utils/pathSafety'
import { retainHistoryItems } from '../src/utils/retention'
import { parseJsonDocument, recoverWithBackup } from '../src/utils/recovery'
import { getConstrainedImageSize } from '../src/utils/imageLimits'
import {
  getBoundedImportSource,
  isTextWithinLimit,
  MAX_HISTORY_TEXT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  MAX_PERSISTED_DATA_BYTES,
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_EDGE,
} from '../src/utils/limits'
import { isThemeSetting, type ThemeSetting } from '../src/theme'
import { isAccentSetting, type AccentSetting } from '../src/personalization'
import { clipboardTypes as CLIPBOARD_TYPES, type ClipboardItem, type ClipboardType, type SavedFilter } from '../src/types/clipboard'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let clipboardWatcher: ReturnType<typeof setInterval> | null = null
let clipboardWatcherRestartTimer: ReturnType<typeof setTimeout> | null = null
let clipboardWatcherErrorCount = 0
let lastClipboardContent = ''
let lastClipboardFormatHash = ''
let lastClipboardImageHash = ''  // 用于图片去重
let lastImageCheckAt = 0
let isQuitting = false
let isMaximized = false
let savedBounds: { x: number; y: number; width: number; height: number } | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pauseUntil = 0
type PauseMode = 'timed' | 'until-resume' | 'application' | null
let pauseMode: PauseMode = null
let pausedWorkspace = ''
let pausedApplicationKey = ''
let protectedToday = 0
let protectedDate = getLocalDateKey()
type HotkeyAction = 'toggle' | 'search' | 'clear'
const currentHotkeys = new Map<HotkeyAction, string>()
const pendingImageDeletes = new Map<string, ReturnType<typeof setTimeout>>()
let storageEncryptionState: 'encrypted' | 'plain' | 'unknown' = 'unknown'
let foregroundTracker: ReturnType<typeof setInterval> | null = null
let foregroundTrackerRequestInFlight = false
let foregroundSampleSequence = 0
let lastAppliedForegroundSample = 0
let currentForegroundTarget: ForegroundTarget | null = null
let lastExternalForegroundTarget: ForegroundTarget | null = null
let quickPasteTarget: ForegroundTarget | null = null
let showWindowPromise: Promise<void> | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) app.quit()

// === Persistence ===
const dataPath = path.join(app.getPath('userData'), 'clipmaster-data.json')
const backupPath = `${dataPath}.bak`
const imagesDir = path.join(app.getPath('userData'), 'images')  // 图片存储目录

// 确保图片目录存在
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true })
}

interface ForegroundTarget {
  hwnd: string
  processId: number
  processName: string
  applicationKey: string
  workspace: string
  capturedAt: number
}

const defaultSettings = {
  maxHistory: 200,
  hotkey: 'CommandOrControl+Shift+V',
  searchHotkey: 'CommandOrControl+Shift+F',
  clearHotkey: 'CommandOrControl+Shift+Delete',
  autoStart: true,
  minimizeToTray: true,
  theme: 'dark' as ThemeSetting,
  accentColor: 'theme' as AccentSetting,
  language: 'system' as 'system' | 'zh-CN' | 'en-US',
  opacity: 0.95,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  listDensity: 'normal' as 'compact' | 'normal' | 'comfortable',
  copyOnSelect: true,
  recordImages: true,
  soundEnabled: false,
  ignoreSensitive: true,
  ignoredPatterns: [] as string[],
  hideAfterCopy: false,
  quickPaste: true,
  recentSearches: [] as string[],
  savedFilters: [] as SavedFilter[],
  autoDeleteDays: 30,
  verificationCodeTtlMinutes: 10,
  autoCheckUpdates: true,
}

type Settings = typeof defaultSettings
type ResolvedLanguage = 'zh-CN' | 'en-US'

const trayTranslations: Record<ResolvedLanguage, Record<string, string>> = {
  'zh-CN': {
    tooltip: 'ClipMaster - 剪贴板管理器',
    show: '显示 ClipMaster',
    search: '搜索剪贴板',
    resume: '恢复记录',
    pause5: '暂停记录 5 分钟',
    pause30: '暂停记录 30 分钟',
    clear: '清空历史',
    settings: '设置',
    quit: '退出',
  },
  'en-US': {
    tooltip: 'ClipMaster - Clipboard Manager',
    show: 'Show ClipMaster',
    search: 'Search clipboard',
    resume: 'Resume recording',
    pause5: 'Pause recording for 5 minutes',
    pause30: 'Pause recording for 30 minutes',
    clear: 'Clear history',
    settings: 'Settings',
    quit: 'Quit',
  },
}

interface AppData {
  schemaVersion?: number
  history: ClipboardItem[]
  settings: Settings
  protectedToday?: number
  protectedDate?: string
  pauseUntil?: number
  pauseMode?: PauseMode
  pausedWorkspace?: string
  pausedApplicationKey?: string
}

let clipboardHistory: ClipboardItem[] = []
let settings: Settings = { ...defaultSettings }
let ignoredRules: CompiledIgnoredRule[] = []

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, num))
}

function sanitizeSavedFilters(input: unknown): SavedFilter[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const filters: SavedFilter[] = []
  for (const candidate of input) {
    const value = asRecord(candidate)
    if (!value || typeof value.id !== 'string' || typeof value.query !== 'string') continue
    const id = value.id.trim().slice(0, 80)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const query = value.query.trim().slice(0, 160)
    const label = (typeof value.label === 'string' ? value.label : query).trim().slice(0, 32) || 'Filter'
    filters.push({
      id,
      label,
      query,
      filterType: typeof value.filterType === 'string' ? value.filterType.slice(0, 32) : null,
      timeFilter: value.timeFilter === 'today' || value.timeFilter === 'week' ? value.timeFilter : 'all',
      sortMode: value.sortMode === 'oldest' || value.sortMode === 'most-used' ? value.sortMode : 'newest',
    })
    if (filters.length === 8) break
  }
  return filters
}

function sanitizeRecentSearches(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const searches: string[] = []
  for (const candidate of input) {
    if (typeof candidate !== 'string') continue
    const value = candidate.trim().replace(/\s+/g, ' ').slice(0, 160)
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    searches.push(value)
    if (searches.length === 5) break
  }
  return searches
}

function sanitizeSettings(input: Partial<Settings> | undefined): Settings {
  const raw = { ...defaultSettings, ...(input || {}) }
  return {
    maxHistory: Math.round(clamp(raw.maxHistory, 50, 500, defaultSettings.maxHistory)),
    hotkey: typeof raw.hotkey === 'string' && raw.hotkey.trim() ? raw.hotkey.trim() : defaultSettings.hotkey,
    searchHotkey: typeof raw.searchHotkey === 'string' && raw.searchHotkey.trim() ? raw.searchHotkey.trim() : defaultSettings.searchHotkey,
    clearHotkey: typeof raw.clearHotkey === 'string' && raw.clearHotkey.trim() ? raw.clearHotkey.trim() : defaultSettings.clearHotkey,
    autoStart: Boolean(raw.autoStart),
    minimizeToTray: Boolean(raw.minimizeToTray),
    theme: isThemeSetting(raw.theme) ? raw.theme : 'dark',
    accentColor: isAccentSetting(raw.accentColor) ? raw.accentColor : 'theme',
    language: raw.language === 'zh-CN' || raw.language === 'en-US' ? raw.language : 'system',
    opacity: clamp(raw.opacity, 0.7, 1, defaultSettings.opacity),
    fontSize: Math.round(clamp(raw.fontSize, 12, 18, defaultSettings.fontSize)),
    windowWidth: Math.round(clamp(raw.windowWidth, 350, 600, defaultSettings.windowWidth)),
    windowHeight: Math.round(clamp(raw.windowHeight, 400, 800, defaultSettings.windowHeight)),
    showPreview: Boolean(raw.showPreview),
    listDensity: raw.listDensity === 'compact' || raw.listDensity === 'comfortable' ? raw.listDensity : 'normal',
    copyOnSelect: Boolean(raw.copyOnSelect),
    recordImages: raw.recordImages !== false,
    soundEnabled: Boolean(raw.soundEnabled),
    ignoreSensitive: raw.ignoreSensitive !== false,
    ignoredPatterns: normalizeIgnoredPatterns(raw.ignoredPatterns),
    hideAfterCopy: Boolean(raw.hideAfterCopy),
    quickPaste: raw.quickPaste !== false,
    recentSearches: sanitizeRecentSearches(raw.recentSearches),
    savedFilters: sanitizeSavedFilters(raw.savedFilters),
    autoDeleteDays: Math.round(clamp(raw.autoDeleteDays, 0, 365, defaultSettings.autoDeleteDays)),
    verificationCodeTtlMinutes: Math.round(clamp(raw.verificationCodeTtlMinutes, 0, 1440, defaultSettings.verificationCodeTtlMinutes)),
    autoCheckUpdates: raw.autoCheckUpdates !== false,
  }
}

function getResolvedLanguage(): ResolvedLanguage {
  if (settings.language === 'zh-CN' || settings.language === 'en-US') return settings.language
  return app.getLocale().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

function getTrayText(key: keyof typeof trayTranslations['zh-CN']) {
  return trayTranslations[getResolvedLanguage()][key]
}

function getClipboardContentType(text: string): ClipboardType {
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) return 'link'
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) return 'email'
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed) || /^rgb/i.test(trimmed)) return 'color'
  if (/^(?:[a-z]:\\|\\\\|\/)[^<>:*?"|]+/i.test(trimmed)) return 'file-path'
  if (/^\+?\d[\d\s-]{6,}\d$/.test(trimmed) && trimmed.replace(/\D/g, '').length <= 18) return 'phone'
  if (/^[\d.,\s+\-*/()]+$/.test(trimmed) && trimmed.length < 50) return 'number'
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return 'json' } catch {}
  }
  if (/^#{1,6}\s|\n[-*]\s|```|\[[^\]]+\]\([^)]+\)/m.test(trimmed)) return 'markdown'
  if (/[{}\[\]();]/.test(trimmed) && (trimmed.includes('function') || trimmed.includes('=>') || trimmed.includes('class') || trimmed.includes('import') || trimmed.includes('const ') || trimmed.includes('let ') || trimmed.includes('var '))) return 'code'
  if (trimmed.length > 100) return 'long-text'
  return 'text'
}

// 生成图片哈希用于去重
function getImageHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').substring(0, 24)
}

function getClipboardFormatHash(content: string, html = '', rtf = '') {
  return createHash('sha256').update(`${content}\u0000${html}\u0000${rtf}`).digest('hex')
}

function isImageHistoryItem(item: ClipboardItem | undefined): item is ClipboardItem & { imagePath: string } {
  return item?.type === 'image' && typeof item.imagePath === 'string' && item.imagePath.length > 0
}

function resolveSafeImagePath(imagePath: string | undefined) {
  if (!imagePath) return null
  const resolvedRoot = path.resolve(imagesDir)
  const resolvedImagePath = path.resolve(imagePath)
  return isResolvedPathInside(resolvedRoot, resolvedImagePath, path.sep, process.platform === 'win32') ? resolvedImagePath : null
}

function getThumbnailPath(imagePath: string) {
  const extension = path.extname(imagePath)
  return path.join(path.dirname(imagePath), `${path.basename(imagePath, extension)}.thumb.jpg`)
}

function ensureImageThumbnail(imagePath: string) {
  const thumbnailPath = getThumbnailPath(imagePath)
  if (fs.existsSync(thumbnailPath)) return thumbnailPath
  const image = nativeImage.createFromPath(imagePath)
  if (image.isEmpty()) return null
  const { width, height } = image.getSize()
  const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(width, height))
  const thumbnail = scale < 1
    ? image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: 'good' })
    : image
  const buffer = thumbnail.toJPEG(72)
  if (buffer.byteLength > MAX_THUMBNAIL_BYTES) return null
  fs.writeFileSync(thumbnailPath, buffer)
  return thumbnailPath
}

function getSafeImageDataUrl(imagePath: string | undefined, size: 'thumb' | 'detail' = 'thumb') {
  if (!imagePath) return null
  try {
    const resolvedImagePath = resolveSafeImagePath(imagePath)
    if (!resolvedImagePath) return null
    if (!fs.existsSync(resolvedImagePath)) return null
    const dataPath = size === 'thumb' ? ensureImageThumbnail(resolvedImagePath) : resolvedImagePath
    if (!dataPath) return null
    const buffer = fs.readFileSync(dataPath)
    const maxBytes = size === 'thumb' ? MAX_THUMBNAIL_BYTES : MAX_IMAGE_BYTES
    if (buffer.byteLength > maxBytes) return null
    const mimeType = path.extname(dataPath).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png'
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch (err) {
    console.error('Failed to read image data url:', err)
    return null
  }
}

function getImageInfo(imagePath: string | undefined) {
  if (!imagePath) return null
  try {
    const resolvedImagePath = resolveSafeImagePath(imagePath)
    if (!resolvedImagePath) return null
    if (!fs.existsSync(resolvedImagePath)) return null
    const stat = fs.statSync(resolvedImagePath)
    const image = nativeImage.createFromPath(resolvedImagePath)
    const size = image.isEmpty() ? { width: 0, height: 0 } : image.getSize()
    return { bytes: stat.size, width: size.width, height: size.height }
  } catch (err) {
    console.error('Failed to read image info:', err)
    return null
  }
}

function cleanupImageCache() {
  try {
    if (!fs.existsSync(imagesDir)) return { deleted: 0, bytes: 0 }
    const used = new Set<string>()
    clipboardHistory
      .map(item => resolveSafeImagePath(item.imagePath))
      .filter((imagePath): imagePath is string => Boolean(imagePath))
      .forEach(imagePath => {
        used.add(imagePath)
        used.add(getThumbnailPath(imagePath))
      })
    let deleted = 0
    let bytes = 0
    for (const fileName of fs.readdirSync(imagesDir)) {
      const filePath = path.resolve(imagesDir, fileName)
      if (!filePath.startsWith(path.resolve(imagesDir) + path.sep)) continue
      if (used.has(filePath)) continue
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) continue
      bytes += stat.size
      fs.unlinkSync(filePath)
      deleted += 1
    }
    return { deleted, bytes }
  } catch (err) {
    console.error('Failed to cleanup image cache:', err)
    return { deleted: 0, bytes: 0 }
  }
}

function canOpenExternalUrl(url: string) {
  return /^(?:https?:\/\/|mailto:)/i.test(url.trim())
}

function canShowFilePath(filePath: string) {
  const trimmed = filePath.trim()
  return /^(?:[a-z]:\\|\\\\|\/)[^<>:*?"|]+/i.test(trimmed)
}

function safeDeleteImageFile(imagePath: string | undefined) {
  if (!imagePath) return
  try {
    const resolvedImagePath = resolveSafeImagePath(imagePath)
    if (!resolvedImagePath) return
    if (clipboardHistory.some(item => resolveSafeImagePath(item.imagePath) === resolvedImagePath)) return
    if (fs.existsSync(resolvedImagePath)) fs.unlinkSync(resolvedImagePath)
    const thumbnailPath = getThumbnailPath(resolvedImagePath)
    if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath)
    const legacyThumbnailPath = path.join(path.dirname(resolvedImagePath), `${path.basename(resolvedImagePath, path.extname(resolvedImagePath))}.thumb.png`)
    if (fs.existsSync(legacyThumbnailPath)) fs.unlinkSync(legacyThumbnailPath)
  } catch (err) {
    console.error('Failed to delete image file:', err)
  }
}

function scheduleImageDelete(imagePath: string | undefined, delayMs: number) {
  if (!imagePath) return
  const existing = pendingImageDeletes.get(imagePath)
  if (existing) clearTimeout(existing)
  if (delayMs <= 0) {
    pendingImageDeletes.delete(imagePath)
    safeDeleteImageFile(imagePath)
    return
  }
  const timer = setTimeout(() => {
    pendingImageDeletes.delete(imagePath)
    safeDeleteImageFile(imagePath)
  }, delayMs)
  pendingImageDeletes.set(imagePath, timer)
}

function cancelImageDelete(imagePath: string | undefined) {
  if (!imagePath) return
  const timer = pendingImageDeletes.get(imagePath)
  if (!timer) return
  clearTimeout(timer)
  pendingImageDeletes.delete(imagePath)
}

function removeHistoryItems(shouldRemove: (item: ClipboardItem) => boolean, imageDeleteDelayMs = 0) {
  const removed: ClipboardItem[] = []
  clipboardHistory = clipboardHistory.filter(item => {
    if (shouldRemove(item)) {
      removed.push(item)
      return false
    }
    return true
  })
  removed.forEach(item => scheduleImageDelete(item.imagePath, imageDeleteDelayMs))
  return removed
}

// 保存剪贴板图片
function saveClipboardImage(): { path: string; hash: string } | null {
  try {
    let image = clipboard.readImage()
    if (image.isEmpty()) return null
    const originalSize = image.getSize()
    const constrainedSize = getConstrainedImageSize(originalSize.width, originalSize.height, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS)
    if (!constrainedSize) return null
    if (constrainedSize.width !== originalSize.width || constrainedSize.height !== originalSize.height) {
      image = image.resize({ ...constrainedSize, quality: 'good' })
    }

    let buffer = image.toPNG()
    for (let attempt = 0; buffer.byteLength > MAX_IMAGE_BYTES && attempt < 3; attempt += 1) {
      const currentSize = image.getSize()
      image = image.resize({
        width: Math.max(1, Math.round(currentSize.width * 0.72)),
        height: Math.max(1, Math.round(currentSize.height * 0.72)),
        quality: 'good',
      })
      buffer = image.toPNG()
    }
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null
    const hash = getImageHash(buffer)

    // 检查是否重复
    if (hash === lastClipboardImageHash) return null

    const imagePath = path.join(imagesDir, `${hash}.png`)
    if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, buffer)
    ensureImageThumbnail(imagePath)
    lastClipboardImageHash = hash
    return { path: imagePath, hash }
  } catch (err) {
    console.error('Failed to save clipboard image:', err)
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
}

const MAX_COPY_TIMESTAMPS = 20

function normalizeWorkspace(value: unknown) {
  if (typeof value !== 'string') return undefined
  const workspace = value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64)
  return workspace || undefined
}

function normalizeSourceApplication(value: unknown) {
  if (typeof value !== 'string') return undefined
  const application = value.replace(/[\u0000-\u001f]/g, '').trim().replace(/\.exe$/i, '').slice(0, 120)
  return application || undefined
}

function normalizeCopyTimestamps(input: unknown, fallbackTimestamp: number) {
  const timestamps = Array.isArray(input) ? input : []
  const unique = new Set<number>()
  for (const value of timestamps) {
    const timestamp = Number(value)
    if (Number.isFinite(timestamp) && timestamp > 0) unique.add(Math.round(timestamp))
  }
  if (unique.size === 0) unique.add(Math.round(fallbackTimestamp))
  return [...unique].sort((a, b) => b - a).slice(0, MAX_COPY_TIMESTAMPS)
}

function recordItemCopy(item: ClipboardItem, at = Date.now()) {
  item.timestamp = at
  item.copyCount = Math.max(1, item.copyCount || 1) + 1
  item.copyTimestamps = normalizeCopyTimestamps([at, ...(item.copyTimestamps || [])], at)
}

function sanitizeHistoryItem(input: unknown, allowImagePath = true): ClipboardItem | null {
  const item = asRecord(input)
  if (!item || typeof item.content !== 'string' || !item.content.trim() || !isTextWithinLimit(item.content)) return null
  const timestamp = Number(item.timestamp)
  const safeTimestamp = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
  const rawType = typeof item.type === 'string' ? item.type : getClipboardContentType(item.content)
  const type = (CLIPBOARD_TYPES as readonly string[]).includes(rawType) ? rawType as ClipboardType : getClipboardContentType(item.content)
  const html = typeof item.html === 'string' && isTextWithinLimit(item.html) ? item.html : undefined
  const rtf = typeof item.rtf === 'string' && isTextWithinLimit(item.rtf) ? item.rtf : undefined
  const imagePath = allowImagePath && typeof item.imagePath === 'string' ? resolveSafeImagePath(item.imagePath) : null
  if (type === 'image' && !imagePath) return null
  return {
    id: typeof item.id === 'string' && item.id ? item.id : generateId(),
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
    tags: normalizeTags(item.tags),
    copyTimestamps: normalizeCopyTimestamps(item.copyTimestamps, safeTimestamp),
    workspace: normalizeWorkspace(item.workspace),
    workspaceManual: Boolean(item.workspaceManual),
    sourceApplication: normalizeSourceApplication(item.sourceApplication),
  }
}

function getHistoryDedupeKey(item: ClipboardItem) {
  return `${item.type}:${item.content}:${item.html || ''}:${item.rtf || ''}`
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
    existing.tags = normalizeTags([...(existing.tags || []), ...(item.tags || [])])
    existing.copyTimestamps = normalizeCopyTimestamps([...(existing.copyTimestamps || []), ...(item.copyTimestamps || [])], existing.timestamp)
    if (!existing.workspace || (!existing.workspaceManual && item.workspaceManual)) {
      existing.workspace = item.workspace
      existing.workspaceManual = item.workspaceManual
    }
    if (!existing.sourceApplication && item.sourceApplication) existing.sourceApplication = item.sourceApplication
  }
  return Array.from(byContent.values()).sort((a, b) => b.timestamp - a.timestamp)
}

function getImportedItems(payload: unknown) {
  return getBoundedImportSource(payload)
    .map(item => sanitizeHistoryItem(item, false))
    .filter(Boolean) as ClipboardItem[]
}

const encryptedStorageFormat = 'clipmaster-encrypted-v1'

function isDataEncryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function serializePersistedData(data: AppData) {
  const plainText = JSON.stringify(data)
  if (!isDataEncryptionAvailable()) {
    storageEncryptionState = 'plain'
    return plainText
  }
  const encrypted = safeStorage.encryptString(plainText).toString('base64')
  storageEncryptionState = 'encrypted'
  return JSON.stringify({ format: encryptedStorageFormat, payload: encrypted })
}

function validatePersistedData(value: unknown): Partial<AppData> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Persisted data must be an object')
  const data = value as Partial<AppData>
  const schemaVersion = data.schemaVersion === undefined ? 1 : Number(data.schemaVersion)
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 2) throw new Error('Unsupported persisted data version')
  return data
}

function readPersistedData(filePath: string): Partial<AppData> {
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size > MAX_PERSISTED_DATA_BYTES) throw new Error('Persisted data file exceeds the safety limit')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const envelope = parseJsonDocument<Record<string, unknown>>(raw)
  if (envelope?.format === encryptedStorageFormat && typeof envelope.payload === 'string') {
    if (!isDataEncryptionAvailable()) throw new Error('Encrypted data is unavailable on this device')
    const decrypted = safeStorage.decryptString(Buffer.from(envelope.payload, 'base64'))
    if (Buffer.byteLength(decrypted, 'utf8') > MAX_PERSISTED_DATA_BYTES) throw new Error('Decrypted data exceeds the safety limit')
    storageEncryptionState = 'encrypted'
    return validatePersistedData(parseJsonDocument<Partial<AppData>>(decrypted))
  }
  storageEncryptionState = 'plain'
  return validatePersistedData(envelope)
}

function applyLoadedData(data: Partial<AppData>) {
  const schemaVersion = data.schemaVersion === undefined ? 1 : Number(data.schemaVersion)
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 2) throw new Error('Unsupported persisted data version')
  clipboardHistory = getBoundedImportSource({ history: data.history })
    .map(item => sanitizeHistoryItem(item, true))
    .filter(Boolean) as ClipboardItem[]
  settings = sanitizeSettings(data.settings)
  ignoredRules = compileIgnoredRules(settings.ignoredPatterns)
  const dailyCounter = normalizeDailyCounter(data.protectedDate, data.protectedToday)
  protectedDate = dailyCounter.date
  protectedToday = dailyCounter.count
  const loadedPauseMode = data.pauseMode === 'timed' || data.pauseMode === 'until-resume' || data.pauseMode === 'application' ? data.pauseMode : null
  const loadedPauseUntil = Number(data.pauseUntil)
  pauseMode = loadedPauseMode
  pauseUntil = Number.isFinite(loadedPauseUntil) && loadedPauseUntil > 0 ? loadedPauseUntil : 0
  pausedWorkspace = normalizeWorkspace(data.pausedWorkspace) || ''
  pausedApplicationKey = typeof data.pausedApplicationKey === 'string'
    ? data.pausedApplicationKey.trim().toLowerCase().replace(/\.exe$/i, '').slice(0, 120)
    : ''
  if (pauseMode === 'timed' && pauseUntil <= Date.now()) {
    pauseMode = null
    pauseUntil = 0
    pausedWorkspace = ''
    pausedApplicationKey = ''
  }
  if (!pauseMode) {
    pauseUntil = 0
    pausedApplicationKey = ''
  }
  applyRetentionRules()
}

function loadData() {
  const recovered = recoverWithBackup(
    () => fs.existsSync(dataPath) ? readPersistedData(dataPath) : null,
    () => fs.existsSync(backupPath) ? readPersistedData(backupPath) : null,
  )
  if (recovered.primaryError) console.error('Failed to load data:', recovered.primaryError)
  if (recovered.backupError) console.error('Failed to load backup data:', recovered.backupError)
  if (recovered.value) {
    applyLoadedData(recovered.value)
    if (storageEncryptionState === 'plain' && isDataEncryptionAvailable()) scheduleSave()
    return
  }
  ignoredRules = compileIgnoredRules(settings.ignoredPatterns)
  const dailyCounter = normalizeDailyCounter(undefined, undefined)
  protectedDate = dailyCounter.date
  protectedToday = dailyCounter.count
}

function saveData() {
  try {
    refreshProtectedCounter()
    const data: AppData = { schemaVersion: 2, history: clipboardHistory, settings, protectedToday, protectedDate, pauseUntil, pauseMode, pausedWorkspace, pausedApplicationKey }
    const serialized = serializePersistedData(data)
    const tmpPath = `${dataPath}.${process.pid}.tmp`
    fs.writeFileSync(tmpPath, serialized, 'utf-8')
    if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, backupPath)
    fs.renameSync(tmpPath, dataPath)
  } catch (err) {
    console.error('Failed to save data:', err)
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveData()
  }, 1000)
}

function flushPendingSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    saveData()
  }
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function isTrustedRenderer(event: IpcMainInvokeEvent) {
  const url = event.senderFrame?.url || ''
  if (isDev) return url === 'http://localhost:5173' || url.startsWith('http://localhost:5173/')
  return url.startsWith('file://')
}

function assertTrustedRenderer(event: IpcMainInvokeEvent) {
  if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer')
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function matchesIgnoredPattern(text: string) {
  return matchesIgnoredRules(ignoredRules, text)
}

function applyRetentionRules() {
  const nextHistory = retainHistoryItems(clipboardHistory, {
    maxHistory: settings.maxHistory,
    autoDeleteDays: settings.autoDeleteDays,
    verificationCodeTtlMinutes: settings.verificationCodeTtlMinutes,
    maxTextBytes: MAX_HISTORY_TEXT_BYTES,
  })
  const nextIds = new Set(nextHistory.map(item => item.id))
  const removedImages = clipboardHistory
    .filter(item => !nextIds.has(item.id))
    .map(item => item.imagePath)
  clipboardHistory = nextHistory
  removedImages.forEach(safeDeleteImageFile)
}

function refreshProtectedCounter() {
  const next = normalizeDailyCounter(protectedDate, protectedToday)
  const changed = next.date !== protectedDate || next.count !== protectedToday
  protectedDate = next.date
  protectedToday = next.count
  return changed
}

function recordProtectedItem() {
  refreshProtectedCounter()
  protectedToday += 1
  emitPrivacyState()
  scheduleSave()
}

const foregroundProcessScript = [
  '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
  'Add-Type @\"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class ClipMasterForeground {',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '}',
  '\"@',
  '$processId = [uint32]0',
  '$window = [ClipMasterForeground]::GetForegroundWindow()',
  'if ($window -eq [IntPtr]::Zero) { return }',
  '[void][ClipMasterForeground]::GetWindowThreadProcessId($window, [ref]$processId)',
  'if (!$processId) { return }',
  '$process = Get-Process -Id $processId -ErrorAction SilentlyContinue',
  'if ($null -eq $process) { return }',
  '[PSCustomObject]@{ hwnd = $window.ToInt64().ToString([System.Globalization.CultureInfo]::InvariantCulture); processId = [int64]$processId; processName = [string]$process.ProcessName } | ConvertTo-Json -Compress',
].join('\n')

const workspaceNames: Record<string, string> = {
  code: 'VS Code',
  devenv: 'Visual Studio',
  chrome: 'Chrome',
  msedge: 'Microsoft Edge',
  firefox: 'Firefox',
  wechat: 'WeChat',
}

function parseForegroundTarget(output: string): ForegroundTarget | null {
  try {
    const raw = asRecord(JSON.parse(output))
    const hwnd = typeof raw?.hwnd === 'string' ? raw.hwnd.trim() : ''
    const processName = typeof raw?.processName === 'string' ? raw.processName.trim().slice(0, 120) : ''
    const processId = typeof raw?.processId === 'number' ? raw.processId : Number(raw?.processId)
    const applicationKey = processName.toLowerCase().replace(/\.exe$/i, '')
    if (!/^\d{1,20}$/.test(hwnd) || !Number.isSafeInteger(processId) || processId <= 0 || !applicationKey) return null
    return {
      hwnd,
      processId,
      processName,
      applicationKey,
      workspace: workspaceNames[applicationKey] || normalizeWorkspace(processName) || applicationKey,
      capturedAt: Date.now(),
    }
  } catch {
    return null
  }
}

function isClipMasterTarget(target: ForegroundTarget | null) {
  if (!target) return false
  return target.applicationKey.includes('clipmaster') || (!app.isPackaged && target.applicationKey === 'electron')
}

function cloneForegroundTarget(target: ForegroundTarget) {
  return { ...target }
}

function maybeResumeApplicationPause() {
  if (pauseMode !== 'application') return
  const target = currentForegroundTarget
  if (!target || isClipMasterTarget(target)) return
  if (pausedApplicationKey) {
    if (target.applicationKey !== pausedApplicationKey) resumeMonitoring()
    return
  }
  if (pausedWorkspace && target.workspace !== pausedWorkspace) resumeMonitoring()
}

function updateForegroundTarget(target: ForegroundTarget | null) {
  currentForegroundTarget = target
  if (!target || isClipMasterTarget(target)) return
  lastExternalForegroundTarget = cloneForegroundTarget(target)
  maybeResumeApplicationPause()
}

function sampleForegroundTarget(): Promise<ForegroundTarget | null> {
  if (process.platform !== 'win32' || isQuitting) return Promise.resolve(null)
  const sampleId = ++foregroundSampleSequence
  return new Promise(resolve => {
    try {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', foregroundProcessScript], {
        encoding: 'utf8',
        timeout: 1200,
        windowsHide: true,
        maxBuffer: 4096,
      }, (error, stdout) => {
        const target = error ? null : parseForegroundTarget(stdout.trim())
        if (!error && sampleId >= lastAppliedForegroundSample) {
          lastAppliedForegroundSample = sampleId
          updateForegroundTarget(target)
        }
        resolve(target)
      })
    } catch {
      resolve(null)
    }
  })
}

function runForegroundTrackerSample() {
  if (foregroundTrackerRequestInFlight || isQuitting) return
  foregroundTrackerRequestInFlight = true
  void sampleForegroundTarget().finally(() => {
    foregroundTrackerRequestInFlight = false
  })
}

function startForegroundTracker() {
  if (foregroundTracker || process.platform !== 'win32' || isQuitting) return
  runForegroundTrackerSample()
  foregroundTracker = setInterval(runForegroundTrackerSample, 1200)
}

function stopForegroundTracker() {
  if (foregroundTracker) {
    clearInterval(foregroundTracker)
    foregroundTracker = null
  }
}

function getCachedWorkspace() {
  const target = currentForegroundTarget
  if (!target || isClipMasterTarget(target) || Date.now() - target.capturedAt > 2500) return ''
  return target.workspace
}

function getCachedApplication() {
  const target = currentForegroundTarget
  if (!target || isClipMasterTarget(target) || Date.now() - target.capturedAt > 2500) return undefined
  return normalizeSourceApplication(target.processName)
}

function getPauseTarget() {
  const target = quickPasteTarget || lastExternalForegroundTarget
  if (!target || isClipMasterTarget(target)) return null
  return cloneForegroundTarget(target)
}

async function captureQuickPasteTarget() {
  quickPasteTarget = null
  if (process.platform !== 'win32') return

  const requestedAt = Date.now()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<null>(resolve => {
    timeoutId = setTimeout(() => resolve(null), 180)
  })
  const target = await Promise.race([sampleForegroundTarget(), timeout])
  if (timeoutId) clearTimeout(timeoutId)
  if (!target || target.capturedAt < requestedAt || isClipMasterTarget(target)) return
  quickPasteTarget = cloneForegroundTarget(target)
}

function isMonitoringPaused() {
  return pauseMode === 'until-resume' || pauseMode === 'application' || (pauseMode === 'timed' && pauseUntil > Date.now())
}

function getPrivacyState() {
  refreshProtectedCounter()
  return { paused: isMonitoringPaused(), pauseUntil, pauseMode, protectedToday }
}

function emitPrivacyState() {
  mainWindow?.webContents.send('privacy-updated', getPrivacyState())
}

function applyAutoStart() {
  try {
    const portableExecutable = process.env.PORTABLE_EXECUTABLE_FILE
    const executablePath = portableExecutable && fs.existsSync(portableExecutable) ? portableExecutable : process.execPath
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      path: executablePath,
    })
  } catch (err) {
    console.error('Failed to update auto start:', err)
  }
}

const hotkeyDefinitions: Array<{ action: HotkeyAction; key: 'hotkey' | 'searchHotkey' | 'clearHotkey' }> = [
  { action: 'toggle', key: 'hotkey' },
  { action: 'search', key: 'searchHotkey' },
  { action: 'clear', key: 'clearHotkey' },
]

function unregisterHotkeys() {
  currentHotkeys.forEach(hotkey => globalShortcut.unregister(hotkey))
  currentHotkeys.clear()
}

function registerHotkeys(nextSettings = settings) {
  unregisterHotkeys()
  let allRegistered = true
  const callbacks: Record<HotkeyAction, () => void> = {
    toggle: () => toggleWindow(),
    search: () => {
      void showWindow().then(() => mainWindow?.webContents.send('focus-search'))
    },
    clear: () => {
      removeHistoryItems(item => !item.pinned && !item.favorited)
      mainWindow?.webContents.send('history-updated', clipboardHistory)
      scheduleSave()
    },
  }
  for (const definition of hotkeyDefinitions) {
    const hotkey = nextSettings[definition.key].trim()
    if (!hotkey || currentHotkeys.has(definition.action) || !globalShortcut.register(hotkey, callbacks[definition.action])) {
      allRegistered = false
      if (hotkey) console.error(`Failed to register shortcut: ${hotkey}`)
      continue
    }
    currentHotkeys.set(definition.action, hotkey)
  }
  return allRegistered
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../dist/icon.ico')

  mainWindow = new BrowserWindow({
    width: settings.windowWidth,
    height: settings.windowHeight,
    x: screenWidth - settings.windowWidth - 20,
    y: screenHeight - settings.windowHeight - 40,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (canOpenExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url === 'http://localhost:5173' || url.startsWith('http://localhost:5173/') : url.startsWith('file://')
    if (!allowed) event.preventDefault()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('blur', () => {
    quickPasteTarget = null
    if (settings.minimizeToTray && mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault()
      quickPasteTarget = null
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function createTray() {
  const trayIconPath = isDev
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../dist/icon.ico')
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  rebuildTrayMenu()
  tray.on('click', () => toggleWindow())
}

function rebuildTrayMenu() {
  if (!tray) return
  const paused = isMonitoringPaused()
  tray.setToolTip(getTrayText('tooltip'))
  const contextMenu = Menu.buildFromTemplate([
    { label: getTrayText('show'), click: () => toggleWindow() },
    { label: getTrayText('search'), click: () => {
      void showWindow().then(() => mainWindow?.webContents.send('focus-search'))
    } },
    { type: 'separator' },
    { label: paused ? getTrayText('resume') : getTrayText('pause5'), click: () => paused ? resumeMonitoring() : pauseMonitoring(5) },
    { label: getTrayText('pause30'), click: () => pauseMonitoring(30) },
    { type: 'separator' },
    { label: getTrayText('clear'), click: () => {
      removeHistoryItems(item => !item.pinned && !item.favorited)
      mainWindow?.webContents.send('history-updated', clipboardHistory)
      scheduleSave()
    }},
    { type: 'separator' },
    { label: getTrayText('settings'), click: () => {
      mainWindow?.webContents.send('show-settings')
      showWindow()
    }},
    { type: 'separator' },
    { label: getTrayText('quit'), click: () => {
      isQuitting = true
      stopClipboardWatcher()
      stopForegroundTracker()
      flushPendingSave()
      app.quit()
    }}
  ])
  tray.setContextMenu(contextMenu)
}

function pauseMonitoring(mode: number | Exclude<PauseMode, null>) {
  if (mode === 'until-resume') {
    pauseMode = mode
    pauseUntil = Number.MAX_SAFE_INTEGER
    pausedWorkspace = ''
    pausedApplicationKey = ''
  } else if (mode === 'application') {
    const target = getPauseTarget()
    if (!target) return pauseMonitoring('until-resume')
    pauseMode = mode
    pauseUntil = Number.MAX_SAFE_INTEGER
    pausedWorkspace = target.workspace
    pausedApplicationKey = target.applicationKey
  } else {
    pauseMode = 'timed'
    pauseUntil = Date.now() + mode * 60 * 1000
    pausedWorkspace = ''
    pausedApplicationKey = ''
  }
  rebuildTrayMenu()
  emitPrivacyState()
  scheduleSave()
}

function resumeMonitoring() {
  pauseUntil = 0
  pauseMode = null
  pausedWorkspace = ''
  pausedApplicationKey = ''
  rebuildTrayMenu()
  emitPrivacyState()
  scheduleSave()
}

async function showWindow() {
  if (mainWindow?.isVisible()) {
    mainWindow.focus()
    return
  }
  if (showWindowPromise) return showWindowPromise
  if (!mainWindow) createWindow()

  showWindowPromise = (async () => {
    await captureQuickPasteTarget()
    mainWindow?.show()
    mainWindow?.focus()
  })().finally(() => {
    showWindowPromise = null
  })
  return showWindowPromise
}

function toggleWindow() {
  if (mainWindow?.isVisible()) {
    quickPasteTarget = null
    mainWindow.hide()
  } else {
    void showWindow()
  }
}

function stopClipboardWatcher() {
  if (clipboardWatcher) {
    clearInterval(clipboardWatcher)
    clipboardWatcher = null
  }
  if (clipboardWatcherRestartTimer) {
    clearTimeout(clipboardWatcherRestartTimer)
    clipboardWatcherRestartTimer = null
  }
}

function scheduleClipboardWatcherRestart(delay = 5000) {
  if (isQuitting || clipboardWatcherRestartTimer) return
  if (clipboardWatcher) {
    clearInterval(clipboardWatcher)
    clipboardWatcher = null
  }
  clipboardWatcherRestartTimer = setTimeout(() => {
    clipboardWatcherRestartTimer = null
    if (!isQuitting) startClipboardWatcher()
  }, delay)
}

function startClipboardWatcher() {
  if (clipboardWatcher || isQuitting) return
  clipboardWatcher = setInterval(() => {
    try {
      if (refreshProtectedCounter()) {
        emitPrivacyState()
        scheduleSave()
      }
      if (pauseMode === 'timed' && pauseUntil > 0 && pauseUntil <= Date.now()) resumeMonitoring()
      maybeResumeApplicationPause()
      if (isMonitoringPaused()) return

      // 错误计数器重置：如果连续成功，重置错误计数
      let hasError = false

      // 检查文本内容
      let currentContent = ''
      let currentHtml = ''
      let currentRtf = ''
      try {
        currentContent = clipboard.readText()
      } catch (readErr) {
        console.error('Failed to read clipboard text:', readErr)
        hasError = true
      }

      try { currentHtml = clipboard.readHTML() } catch {}
      try { currentRtf = clipboard.readRTF() } catch {}
      if (!isTextWithinLimit(currentHtml)) currentHtml = ''
      if (!isTextWithinLimit(currentRtf)) currentRtf = ''
      const clipboardFormatHash = getClipboardFormatHash(currentContent, currentHtml, currentRtf)

      if (currentContent && currentContent !== lastClipboardContent && !isTextWithinLimit(currentContent)) {
        lastClipboardContent = currentContent
        lastClipboardFormatHash = clipboardFormatHash
        currentContent = ''
        currentHtml = ''
        currentRtf = ''
      }

      if (currentContent && clipboardFormatHash !== lastClipboardFormatHash && matchesIgnoredPattern(currentContent)) {
        lastClipboardContent = currentContent
        lastClipboardFormatHash = clipboardFormatHash
        recordProtectedItem()
        return
      }

      if (settings.ignoreSensitive && currentContent && clipboardFormatHash !== lastClipboardFormatHash && isSensitiveClipboardContent(currentContent)) {
        lastClipboardContent = currentContent
        lastClipboardFormatHash = clipboardFormatHash
        recordProtectedItem()
        return
      }

      // 检查图片内容
      let imageInfo: { path: string; hash: string } | null = null
      const shouldCheckImage = Date.now() - lastImageCheckAt >= 2500
      if (settings.recordImages && shouldCheckImage) {
        lastImageCheckAt = Date.now()
        try {
          imageInfo = saveClipboardImage()
        } catch (imgErr) {
          console.error('Failed to save clipboard image:', imgErr)
        }
      }

      // 处理文本内容
      if ((currentContent || currentHtml || currentRtf) && clipboardFormatHash !== lastClipboardFormatHash) {
        lastClipboardContent = currentContent
        lastClipboardFormatHash = clipboardFormatHash

        const existingIndex = clipboardHistory.findIndex(item => item.content === currentContent && (item.html || '') === currentHtml && (item.rtf || '') === currentRtf)
        if (existingIndex !== -1) {
          const existing = clipboardHistory.splice(existingIndex, 1)[0]
          recordItemCopy(existing)
          if (!existing.workspaceManual) existing.workspace = getCachedWorkspace() || existing.workspace
          existing.sourceApplication = getCachedApplication() || existing.sourceApplication
          clipboardHistory.unshift(existing)
        } else {
          const now = Date.now()
          clipboardHistory.unshift({
            id: generateId(),
            content: currentContent,
            html: currentHtml || undefined,
            rtf: currentRtf || undefined,
            type: getClipboardContentType(currentContent),
            timestamp: now,
            pinned: false,
            favorited: false,
            copyCount: 1,
            firstTimestamp: now,
            copyTimestamps: [now],
            workspace: getCachedWorkspace() || undefined,
            sourceApplication: getCachedApplication(),
          })
        }

        applyRetentionRules()
        mainWindow?.webContents.send('history-updated', clipboardHistory)
        scheduleSave()
      }

      // 处理图片内容
      if (imageInfo) {
        const existingIndex = clipboardHistory.findIndex(item => item.type === 'image' && item.content === `[图片] ${imageInfo.hash}`)
        if (existingIndex !== -1) {
          const existing = clipboardHistory.splice(existingIndex, 1)[0]
          recordItemCopy(existing)
          if (!existing.workspaceManual) existing.workspace = getCachedWorkspace() || existing.workspace
          existing.sourceApplication = getCachedApplication() || existing.sourceApplication
          existing.imagePath = imageInfo.path
          clipboardHistory.unshift(existing)
        } else {
          const now = Date.now()
          clipboardHistory.unshift({
            id: generateId(),
            content: `[图片] ${imageInfo.hash}`,
            type: 'image',
            timestamp: now,
            pinned: false,
            favorited: false,
            copyCount: 1,
            firstTimestamp: now,
            imagePath: imageInfo.path,
            copyTimestamps: [now],
            workspace: getCachedWorkspace() || undefined,
            sourceApplication: getCachedApplication(),
          })
        }
        applyRetentionRules()
        mainWindow?.webContents.send('history-updated', clipboardHistory)
        scheduleSave()
      }

      // 错误处理
      if (hasError) {
        clipboardWatcherErrorCount++
        if (clipboardWatcherErrorCount > 10) {
          console.error('Clipboard watcher error count exceeded, restarting...')
          clipboardWatcherErrorCount = 0
          scheduleClipboardWatcherRestart()
        }
      } else {
        clipboardWatcherErrorCount = 0
      }
    } catch (err) {
      console.error('Clipboard watcher failed:', err)
      clipboardWatcherErrorCount++
      if (clipboardWatcherErrorCount > 10) {
        console.error('Clipboard watcher critical error, restarting...')
        clipboardWatcherErrorCount = 0
        scheduleClipboardWatcherRestart()
      }
    }
  }, 650)
}

// IPC Handlers
ipcMain.handle('get-image-data-url', (_, imagePath: string | undefined, size: 'thumb' | 'detail' = 'thumb') => getSafeImageDataUrl(imagePath, size === 'detail' ? 'detail' : 'thumb'))
ipcMain.handle('get-image-info', (_, imagePath: string | undefined) => getImageInfo(imagePath))
ipcMain.handle('cleanup-image-cache', () => cleanupImageCache())
ipcMain.handle('open-external-url', async (event, url: string) => {
  assertTrustedRenderer(event)
  if (!canOpenExternalUrl(url)) return false
  await shell.openExternal(url.trim())
  return true
})
ipcMain.handle('show-file-in-folder', async (event, filePath: string) => {
  assertTrustedRenderer(event)
  if (!canShowFilePath(filePath)) return false
  shell.showItemInFolder(filePath.trim())
  return true
})
ipcMain.handle('get-history', () => clipboardHistory)
ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-data-security-status', () => {
  const available = isDataEncryptionAvailable()
  return {
    available,
    active: available && storageEncryptionState !== 'plain',
    migrating: available && storageEncryptionState === 'plain',
  }
})

interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  downloadUrl: string
  releaseNotes: string
  publishedAt: string | null
}

interface UpdateDownloadProgress {
  receivedBytes: number
  totalBytes: number | null
  percent: number | null
}

let updateCache: { checkedAt: number; info: UpdateInfo } | null = null
const latestReleaseUrl = 'https://github.com/dhadb/ClipMaster/releases/latest'
const latestReleaseApiUrl = 'https://api.github.com/repos/dhadb/ClipMaster/releases/latest'
const maxUpdateDownloadBytes = 300 * 1024 * 1024
let downloadedInstallerPath: string | null = null
let downloadedInstallerVersion: string | null = null
let updateDownloadPromise: Promise<{ version: string }> | null = null

function getUpdateDownloadUrl(version: string) {
  const encodedVersion = encodeURIComponent(version)
  return `https://github.com/dhadb/ClipMaster/releases/download/v${encodedVersion}/ClipMaster-Setup-${encodedVersion}.exe`
}

function getUpdateChecksumsUrl(version: string) {
  const encodedVersion = encodeURIComponent(version)
  return `https://github.com/dhadb/ClipMaster/releases/download/v${encodedVersion}/checksums.sha256`
}

async function calculateFileSha256(filePath: string) {
  const hash = createHash('sha256')
  return new Promise<string>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function getExpectedUpdateHash(info: UpdateInfo, installerPath: string) {
  const response = await net.fetch(getUpdateChecksumsUrl(info.latestVersion), {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'text/plain',
      'User-Agent': `ClipMaster/${info.currentVersion}`,
    },
  })
  if (!response.ok) throw new Error(`Checksum request failed with status ${response.status}`)
  const fileName = path.basename(installerPath)
  const checksum = parseReleaseChecksum(await response.text(), fileName)
  if (!checksum) throw new Error(`Checksum for ${fileName} was not found`)
  return checksum
}

function emitUpdateDownloadProgress(progress: UpdateDownloadProgress) {
  mainWindow?.webContents.send('update-download-progress', progress)
}

async function downloadInstaller(info: UpdateInfo): Promise<{ version: string }> {
  const installerPath = path.join(app.getPath('temp'), `ClipMaster-Setup-${info.latestVersion}.exe`)
  const partialPath = `${installerPath}.download`
  const expectedHash = await getExpectedUpdateHash(info, installerPath)

  if (downloadedInstallerPath && downloadedInstallerVersion === info.latestVersion && fs.existsSync(downloadedInstallerPath)) {
    const cachedHash = await calculateFileSha256(downloadedInstallerPath)
    if (cachedHash !== expectedHash) {
      await fs.promises.rm(downloadedInstallerPath, { force: true })
      downloadedInstallerPath = null
      downloadedInstallerVersion = null
    } else {
      const cachedSize = fs.statSync(downloadedInstallerPath).size
      emitUpdateDownloadProgress({ receivedBytes: cachedSize, totalBytes: cachedSize, percent: 100 })
      return { version: info.latestVersion }
    }
  }

  await fs.promises.rm(partialPath, { force: true })
  emitUpdateDownloadProgress({ receivedBytes: 0, totalBytes: null, percent: null })

  const response = await net.fetch(info.downloadUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(5 * 60 * 1000),
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': `ClipMaster/${info.currentVersion}`,
    },
  })
  if (!response.ok) throw new Error(`Download request failed with status ${response.status}`)
  if (!response.body) throw new Error('Update download returned an empty response')

  const contentLength = Number(response.headers.get('content-length'))
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  if (totalBytes !== null && totalBytes > maxUpdateDownloadBytes) throw new Error('Update package is too large')

  let receivedBytes = 0
  const reader = response.body.getReader()
  const file = await fs.promises.open(partialPath, 'w')
  let downloadError: unknown = null
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      receivedBytes += value.byteLength
      if (receivedBytes > maxUpdateDownloadBytes) throw new Error('Update package is too large')
      await file.write(Buffer.from(value))
      const percent = totalBytes ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : null
      emitUpdateDownloadProgress({ receivedBytes, totalBytes, percent })
    }
  } catch (error) {
    downloadError = error
  } finally {
    await file.close()
    await reader.cancel().catch(() => undefined)
  }
  if (downloadError) {
    await fs.promises.rm(partialPath, { force: true })
    throw downloadError
  }

  if (receivedBytes === 0) throw new Error('Update download returned an empty file')
  await fs.promises.rm(installerPath, { force: true })
  await fs.promises.rename(partialPath, installerPath)
  const actualHash = await calculateFileSha256(installerPath)
  if (actualHash !== expectedHash) {
    await fs.promises.rm(installerPath, { force: true })
    throw new Error('Downloaded update failed checksum verification')
  }
  downloadedInstallerPath = installerPath
  downloadedInstallerVersion = info.latestVersion
  emitUpdateDownloadProgress({ receivedBytes, totalBytes: totalBytes || receivedBytes, percent: 100 })
  return { version: info.latestVersion }
}

ipcMain.handle('check-for-updates', async (event, force = false): Promise<UpdateInfo> => {
  assertTrustedRenderer(event)
  if (!force && updateCache && Date.now() - updateCache.checkedAt < 10 * 60 * 1000) return updateCache.info

  const currentVersion = app.getVersion()
  let info: UpdateInfo | null = null

  try {
    const response = await net.fetch(latestReleaseApiUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `ClipMaster/${currentVersion}`,
      },
    })
    if (response.ok) {
      const release = parseClipMasterReleaseApiPayload(await response.json())
      if (release) {
        info = {
          currentVersion,
          latestVersion: release.latestVersion,
          hasUpdate: compareVersions(release.latestVersion, currentVersion) > 0,
          releaseUrl: release.releaseUrl,
          downloadUrl: getUpdateDownloadUrl(release.latestVersion),
          releaseNotes: release.releaseNotes,
          publishedAt: release.publishedAt,
        }
      }
    }
  } catch {
    info = null
  }

  if (!info) {
    const response = await net.fetch(latestReleaseUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'text/html',
        'User-Agent': `ClipMaster/${currentVersion}`,
      },
    })
    if (!response.ok) throw new Error(`Update request failed with status ${response.status}`)

    const releasePage = await response.text()
    const release = parseClipMasterReleaseUrl(response.url) || parseClipMasterReleasePage(releasePage)
    if (!release) throw new Error('Update response did not resolve to a valid release')
    info = {
      currentVersion,
      latestVersion: release.latestVersion,
      hasUpdate: compareVersions(release.latestVersion, currentVersion) > 0,
      releaseUrl: release.releaseUrl,
      downloadUrl: getUpdateDownloadUrl(release.latestVersion),
      releaseNotes: '',
      publishedAt: null,
    }
  }
  updateCache = { checkedAt: Date.now(), info }
  return info
})

ipcMain.handle('download-update', async event => {
  assertTrustedRenderer(event)
  const info = updateCache?.info
  if (!info?.hasUpdate) throw new Error('No update is available')
  if (!updateDownloadPromise) {
    updateDownloadPromise = downloadInstaller(info).finally(() => { updateDownloadPromise = null })
  }
  return updateDownloadPromise
})

ipcMain.handle('install-update', async event => {
  assertTrustedRenderer(event)
  if (!downloadedInstallerPath || !downloadedInstallerVersion || !fs.existsSync(downloadedInstallerPath)) {
    throw new Error('Update package has not been downloaded')
  }
  const openError = await shell.openPath(downloadedInstallerPath)
  if (openError) throw new Error(openError)
  isQuitting = true
  flushPendingSave()
  stopClipboardWatcher()
  stopForegroundTracker()
  app.quit()
  return { version: downloadedInstallerVersion }
})

ipcMain.handle('create-item', (event, draft: { content?: unknown; tags?: unknown; pinned?: unknown; favorited?: unknown }) => {
  assertTrustedRenderer(event)
  const content = typeof draft?.content === 'string' ? draft.content : ''
  if (!content.trim()) return { history: clipboardHistory, itemId: null, created: false }
  if (!isTextWithinLimit(content)) throw new Error('Clipboard item is too large')

  const tags = normalizeTags(draft.tags)
  const existingIndex = clipboardHistory.findIndex(item => item.type !== 'image' && item.content === content)
  let item: ClipboardItem
  let created = false

  if (existingIndex >= 0) {
    item = clipboardHistory.splice(existingIndex, 1)[0]
    recordItemCopy(item)
    item.tags = normalizeTags([...(item.tags || []), ...tags])
    item.pinned = item.pinned || Boolean(draft.pinned)
    item.favorited = item.favorited || Boolean(draft.favorited)
  } else {
    const now = Date.now()
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

  clipboardHistory.unshift(item)
  applyRetentionRules()
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return { history: clipboardHistory, itemId: item.id, created }
})

ipcMain.handle('update-item-tags', (event, id: string, tags: unknown) => {
  assertTrustedRenderer(event)
  const item = clipboardHistory.find(item => item.id === id)
  if (!item) return clipboardHistory
  item.tags = normalizeTags(tags)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('update-item', (event, id: string, patch: { content?: unknown; tags?: unknown; workspace?: unknown }) => {
  assertTrustedRenderer(event)
  const item = clipboardHistory.find(entry => entry.id === id)
  if (!item || item.type === 'image') return clipboardHistory

  if (typeof patch?.content === 'string') {
    if (!patch.content.trim()) throw new Error('Clipboard item cannot be empty')
    if (!isTextWithinLimit(patch.content)) throw new Error('Clipboard item is too large')
    item.content = patch.content
    item.html = undefined
    item.rtf = undefined
    item.type = getClipboardContentType(patch.content)
    item.timestamp = Date.now()
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'tags')) item.tags = normalizeTags(patch.tags)
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'workspace')) {
    item.workspace = normalizeWorkspace(patch.workspace)
    item.workspaceManual = Boolean(item.workspace)
  }

  clipboardHistory = dedupeHistory(clipboardHistory)
  applyRetentionRules()
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

const targetedPasteScript = [
  'Add-Type @\"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class ClipMasterPaste {',
  '  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion U; }',
  '  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern bool IsWindow(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern bool SetForegroundWindow(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint nInputs, [In] INPUT[] pInputs, int cbSize);',
  '  public static INPUT CreateKeyInput(ushort virtualKey, bool keyUp) {',
  '    return new INPUT { type = 1, U = new InputUnion { ki = new KEYBDINPUT { wVk = virtualKey, dwFlags = keyUp ? 0x0002u : 0u } } };',
  '  }',
  '}',
  '\"@',
  '$rawHandle = $env:CLIPMASTER_TARGET_HWND',
  '$rawPid = $env:CLIPMASTER_TARGET_PID',
  '$ok = $false',
  'try {',
  '  if ($rawHandle -notmatch "^\\d{1,20}$" -or $rawPid -notmatch "^\\d{1,10}$") { throw "Invalid target" }',
  '  $target = [IntPtr]::new([Int64]$rawHandle)',
  '  $expectedPid = [uint32]$rawPid',
  '  if (-not [ClipMasterPaste]::IsWindow($target)) { throw "Closed target" }',
  '  $actualPid = [uint32]0',
  '  [void][ClipMasterPaste]::GetWindowThreadProcessId($target, [ref]$actualPid)',
  '  if ($actualPid -ne $expectedPid) { throw "Changed target" }',
  '  if ([ClipMasterPaste]::IsIconic($target)) { [void][ClipMasterPaste]::ShowWindowAsync($target, 9) }',
  '  if (-not [ClipMasterPaste]::SetForegroundWindow($target)) { throw "Foreground denied" }',
  '  Start-Sleep -Milliseconds 50',
  '  if ([ClipMasterPaste]::GetForegroundWindow() -ne $target) { throw "Foreground changed" }',
  '  $inputs = [ClipMasterPaste+INPUT[]]@(',
  '    [ClipMasterPaste]::CreateKeyInput(0x11, $false),',
  '    [ClipMasterPaste]::CreateKeyInput(0x56, $false),',
  '    [ClipMasterPaste]::CreateKeyInput(0x56, $true),',
  '    [ClipMasterPaste]::CreateKeyInput(0x11, $true)',
  '  )',
  '  $sent = [ClipMasterPaste]::SendInput([uint32]4, $inputs, [Runtime.InteropServices.Marshal]::SizeOf([type][ClipMasterPaste+INPUT]))',
  '  $ok = $sent -eq 4',
  '} catch {}',
  'if ($ok) { [Console]::Out.Write("ok") } else { [Console]::Out.Write("failed") }',
].join('\n')

function isUsableQuickPasteTarget(target: ForegroundTarget | null): target is ForegroundTarget {
  return Boolean(target
    && !isClipMasterTarget(target)
    && /^\d{1,20}$/.test(target.hwnd)
    && Number.isSafeInteger(target.processId)
    && target.processId > 0)
}

function sendTargetedPaste(target: ForegroundTarget | null) {
  if (process.platform !== 'win32' || !isUsableQuickPasteTarget(target)) return
  try {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', targetedPasteScript], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
      maxBuffer: 1024,
      env: {
        ...process.env,
        CLIPMASTER_TARGET_HWND: target.hwnd,
        CLIPMASTER_TARGET_PID: String(target.processId),
      },
    }, (error, stdout) => {
      if (error || stdout.trim() !== 'ok') console.warn('Quick paste did not reach its saved target; content remains copied.')
    })
  } catch (err) {
    console.error('Failed to target quick paste:', err)
  }
}

ipcMain.handle('copy-to-clipboard', (event, itemOrContent: ClipboardItem | string, options?: { pasteAfterCopy?: unknown }) => {
  assertTrustedRenderer(event)
  const pasteAfterCopy = options?.pasteAfterCopy === true && settings.quickPaste
  const finishCopy = () => {
    if (pasteAfterCopy) {
      const target = quickPasteTarget ? cloneForegroundTarget(quickPasteTarget) : null
      quickPasteTarget = null
      mainWindow?.hide()
      setTimeout(() => sendTargetedPaste(target), 80)
    } else if (settings.hideAfterCopy) {
      quickPasteTarget = null
      mainWindow?.hide()
    }
  }

  if (typeof itemOrContent === 'string') {
    if (!isTextWithinLimit(itemOrContent)) throw new Error('Clipboard item is too large')
    clipboard.writeText(itemOrContent)
    lastClipboardContent = itemOrContent
    lastClipboardFormatHash = getClipboardFormatHash(itemOrContent)
    finishCopy()
    return clipboardHistory
  }

  const historyItem = clipboardHistory.find(item => item.id === itemOrContent.id)
  const item = historyItem || sanitizeHistoryItem(itemOrContent, true)
  if (!item) return clipboardHistory
  const safeImagePath = isImageHistoryItem(item) ? resolveSafeImagePath(item.imagePath) : null

  if (safeImagePath && fs.existsSync(safeImagePath)) {
    const image = nativeImage.createFromPath(safeImagePath)
    if (!image.isEmpty()) {
      clipboard.writeImage(image)
      lastClipboardImageHash = path.basename(safeImagePath, path.extname(safeImagePath))
      lastImageCheckAt = Date.now()
    } else {
      clipboard.write({ text: item.content, ...(item.html ? { html: item.html } : {}), ...(item.rtf ? { rtf: item.rtf } : {}) })
      lastClipboardContent = item.content
      lastClipboardFormatHash = getClipboardFormatHash(item.content, item.html, item.rtf)
    }
  } else {
    clipboard.write({ text: item.content, ...(item.html ? { html: item.html } : {}), ...(item.rtf ? { rtf: item.rtf } : {}) })
    lastClipboardContent = item.content
    lastClipboardFormatHash = getClipboardFormatHash(item.content, item.html, item.rtf)
  }

  if (historyItem) {
    const historyIndex = clipboardHistory.findIndex(entry => entry.id === historyItem.id)
    if (historyIndex >= 0) clipboardHistory.splice(historyIndex, 1)
    recordItemCopy(historyItem)
    clipboardHistory.unshift(historyItem)
    scheduleSave()
    mainWindow?.webContents.send('history-updated', clipboardHistory)
  }
  finishCopy()
  return clipboardHistory
})

ipcMain.handle('delete-item', (event, id: string) => {
  assertTrustedRenderer(event)
  removeHistoryItems(item => item.id === id)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('delete-items', (event, ids: unknown) => {
  assertTrustedRenderer(event)
  const safeIds = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').slice(0, 500) : [])
  const deleted = removeHistoryItems(item => safeIds.has(item.id), 8000)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return { history: clipboardHistory, deleted }
})

ipcMain.handle('restore-items', (event, items: unknown) => {
  assertTrustedRenderer(event)
  const restored = (Array.isArray(items) ? items : [])
    .slice(0, 500)
    .map(sanitizeHistoryItem)
    .filter(Boolean) as ClipboardItem[]
  if (restored.length === 0) return clipboardHistory
  restored.forEach(item => cancelImageDelete(item.imagePath))
  clipboardHistory = dedupeHistory([...restored, ...clipboardHistory])
  applyRetentionRules()
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('batch-update-items', (event, ids: unknown, patch: { pinned?: unknown; favorited?: unknown; addTags?: unknown }) => {
  assertTrustedRenderer(event)
  const safeIds = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').slice(0, 500) : [])
  const tags = normalizeTags(patch?.addTags)
  for (const item of clipboardHistory) {
    if (!safeIds.has(item.id)) continue
    if (typeof patch?.pinned === 'boolean') item.pinned = patch.pinned
    if (typeof patch?.favorited === 'boolean') item.favorited = patch.favorited
    if (tags.length > 0) item.tags = normalizeTags([...(item.tags || []), ...tags])
  }
  applyRetentionRules()
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('toggle-pin', (event, id: string) => {
  assertTrustedRenderer(event)
  const item = clipboardHistory.find(item => item.id === id)
  if (item) {
    item.pinned = !item.pinned
    applyRetentionRules()
  }
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('toggle-favorite', (event, id: string) => {
  assertTrustedRenderer(event)
  const item = clipboardHistory.find(item => item.id === id)
  if (item) {
    item.favorited = !item.favorited
    applyRetentionRules()
  }
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('clear-history', event => {
  assertTrustedRenderer(event)
  removeHistoryItems(item => !item.pinned && !item.favorited)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('clear-all-history', event => {
  assertTrustedRenderer(event)
  removeHistoryItems(() => true)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('import-history', (event, payload: unknown, mode: 'merge' | 'replace' = 'merge') => {
  assertTrustedRenderer(event)
  const imported = getImportedItems(payload)
  if (imported.length === 0) return { history: clipboardHistory, imported: 0 }

  if (mode === 'replace') {
    clipboardHistory = dedupeHistory(imported)
  } else {
    clipboardHistory = dedupeHistory([...imported, ...clipboardHistory])
  }

  const payloadRecord = asRecord(payload)
  if (payloadRecord?.settings && typeof payloadRecord.settings === 'object') {
    const oldSettings = settings
    const nextSettings = {
      ...sanitizeSettings({ ...settings, ...payloadRecord.settings }),
      hotkey: oldSettings.hotkey,
      searchHotkey: oldSettings.searchHotkey,
      clearHotkey: oldSettings.clearHotkey,
    }
    settings = nextSettings
    ignoredRules = compileIgnoredRules(settings.ignoredPatterns)
    applyAutoStart()
    mainWindow?.webContents.send('settings-updated', settings)
  }

  applyRetentionRules()
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return { history: clipboardHistory, imported: imported.length }
})

ipcMain.handle('get-settings', () => settings)

ipcMain.handle('update-settings', (event, newSettings: Partial<Settings>) => {
  assertTrustedRenderer(event)
  const oldSettings = settings
  let nextSettings = sanitizeSettings({ ...settings, ...newSettings })

  const hotkeysChanged = hotkeyDefinitions.some(({ key }) => oldSettings[key] !== nextSettings[key])
  if (hotkeysChanged && !registerHotkeys(nextSettings)) {
    nextSettings = sanitizeSettings({ ...nextSettings, hotkey: oldSettings.hotkey, searchHotkey: oldSettings.searchHotkey, clearHotkey: oldSettings.clearHotkey })
    registerHotkeys(nextSettings)
  }

  settings = nextSettings
  ignoredRules = compileIgnoredRules(settings.ignoredPatterns)

  if (oldSettings.autoStart !== settings.autoStart) applyAutoStart()
  if (oldSettings.language !== settings.language) rebuildTrayMenu()
  if (oldSettings.maxHistory !== settings.maxHistory || oldSettings.autoDeleteDays !== settings.autoDeleteDays || oldSettings.verificationCodeTtlMinutes !== settings.verificationCodeTtlMinutes) {
    applyRetentionRules()
    mainWindow?.webContents.send('history-updated', clipboardHistory)
  }

  mainWindow?.webContents.send('settings-updated', settings)
  scheduleSave()

  if (oldSettings.windowWidth !== settings.windowWidth || oldSettings.windowHeight !== settings.windowHeight) {
    mainWindow?.setSize(settings.windowWidth, settings.windowHeight)
  }
  return settings
})

ipcMain.handle('get-privacy-state', () => getPrivacyState())
ipcMain.handle('pause-monitoring', (event, requestedMode: number | 'until-resume' | 'current-application') => {
  assertTrustedRenderer(event)
  if (requestedMode === 'until-resume') pauseMonitoring('until-resume')
  else if (requestedMode === 'current-application') pauseMonitoring('application')
  else pauseMonitoring(clamp(requestedMode, 1, 1440, 5))
  return getPrivacyState()
})
ipcMain.handle('resume-monitoring', event => {
  assertTrustedRenderer(event)
  resumeMonitoring()
  return getPrivacyState()
})

ipcMain.handle('minimize-window', event => {
  assertTrustedRenderer(event)
  if (!mainWindow) return
  if (settings.minimizeToTray) mainWindow.hide()
  else mainWindow.minimize()
})
ipcMain.handle('close-window', event => {
  assertTrustedRenderer(event)
  mainWindow?.close()
})
ipcMain.handle('toggle-maximize', event => {
  assertTrustedRenderer(event)
  if (!mainWindow) return
  if (isMaximized) {
    if (savedBounds) {
      mainWindow.setBounds(savedBounds)
    } else {
      mainWindow.unmaximize()
    }
    isMaximized = false
  } else {
    savedBounds = mainWindow.getBounds()
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    mainWindow.setBounds({ x: 0, y: 0, width: screenWidth, height: screenHeight })
    isMaximized = true
  }
})

// App lifecycle
if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    showWindow()
  })

  app.whenReady().then(() => {
    loadData()
    cleanupImageCache()
    applyAutoStart()
    createWindow()
    createTray()
    startForegroundTracker()
    startClipboardWatcher()
    registerHotkeys()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !settings.minimizeToTray) app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('before-quit', () => {
    isQuitting = true
    flushPendingSave()
    stopClipboardWatcher()
    stopForegroundTracker()
    unregisterHotkeys()
    pendingImageDeletes.forEach(timer => clearTimeout(timer))
    pendingImageDeletes.clear()
  })
}
