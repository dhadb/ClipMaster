import { app, BrowserWindow, Tray, Menu, clipboard, globalShortcut, nativeImage, ipcMain, screen, shell } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let clipboardWatcher: ReturnType<typeof setInterval> | null = null
let clipboardWatcherRestartTimer: ReturnType<typeof setTimeout> | null = null
let clipboardWatcherErrorCount = 0
let lastClipboardContent = ''
let lastClipboardImageHash = ''  // 用于图片去重
let lastImageCheckAt = 0
let isQuitting = false
let isMaximized = false
let savedBounds: { x: number; y: number; width: number; height: number } | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pauseUntil = 0
let protectedToday = 0
let currentHotkey = ''

// === Persistence ===
const dataPath = path.join(app.getPath('userData'), 'clipmaster-data.json')
const backupPath = `${dataPath}.bak`
const imagesDir = path.join(app.getPath('userData'), 'images')  // 图片存储目录

// 确保图片目录存在
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true })
}

const CLIPBOARD_TYPES = ['text', 'link', 'email', 'color', 'number', 'code', 'long-text', 'json', 'markdown', 'file-path', 'phone', 'image'] as const
type ClipboardType = typeof CLIPBOARD_TYPES[number]

interface ClipboardItem {
  id: string
  content: string
  type: ClipboardType
  timestamp: number
  pinned: boolean
  favorited: boolean
  copyCount: number
  firstTimestamp: number
  imagePath?: string  // 图片路径
  tags?: string[]  // 智能标签
}

const defaultSettings = {
  maxHistory: 200,
  hotkey: 'CommandOrControl+Shift+V',
  autoStart: true,
  minimizeToTray: true,
  theme: 'dark' as 'dark' | 'light' | 'auto',
  language: 'system' as 'system' | 'zh-CN' | 'en-US',
  opacity: 0.95,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  showShortcutHints: true,
  listDensity: 'normal' as 'compact' | 'normal' | 'comfortable',
  copyOnSelect: true,
  recordImages: true,
  soundEnabled: false,
  ignoreSensitive: true,
  ignoredPatterns: [] as string[],
  hideAfterCopy: false,
  autoDeleteDays: 30,
  verificationCodeTtlMinutes: 10,
}

type Settings = typeof defaultSettings
type ResolvedLanguage = 'zh-CN' | 'en-US'

const trayTranslations: Record<ResolvedLanguage, Record<string, string>> = {
  'zh-CN': {
    tooltip: 'ClipMaster - 剪贴板管理器',
    show: '显示 ClipMaster',
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
    resume: 'Resume recording',
    pause5: 'Pause recording for 5 minutes',
    pause30: 'Pause recording for 30 minutes',
    clear: 'Clear history',
    settings: 'Settings',
    quit: 'Quit',
  },
}

interface AppData {
  history: ClipboardItem[]
  settings: Settings
  protectedToday?: number
}

let clipboardHistory: ClipboardItem[] = []
let settings: Settings = { ...defaultSettings }

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, num))
}

function sanitizeSettings(input: Partial<Settings> | undefined): Settings {
  const raw = { ...defaultSettings, ...(input || {}) }
  return {
    maxHistory: Math.round(clamp(raw.maxHistory, 50, 500, defaultSettings.maxHistory)),
    hotkey: typeof raw.hotkey === 'string' && raw.hotkey.trim() ? raw.hotkey.trim() : defaultSettings.hotkey,
    autoStart: Boolean(raw.autoStart),
    minimizeToTray: Boolean(raw.minimizeToTray),
    theme: raw.theme === 'light' || raw.theme === 'auto' ? raw.theme : 'dark',
    language: raw.language === 'zh-CN' || raw.language === 'en-US' ? raw.language : 'system',
    opacity: clamp(raw.opacity, 0.7, 1, defaultSettings.opacity),
    fontSize: Math.round(clamp(raw.fontSize, 12, 18, defaultSettings.fontSize)),
    windowWidth: Math.round(clamp(raw.windowWidth, 350, 600, defaultSettings.windowWidth)),
    windowHeight: Math.round(clamp(raw.windowHeight, 400, 800, defaultSettings.windowHeight)),
    showPreview: Boolean(raw.showPreview),
    showShortcutHints: raw.showShortcutHints !== false,
    listDensity: raw.listDensity === 'compact' || raw.listDensity === 'comfortable' ? raw.listDensity : 'normal',
    copyOnSelect: Boolean(raw.copyOnSelect),
    recordImages: raw.recordImages !== false,
    soundEnabled: Boolean(raw.soundEnabled),
    ignoreSensitive: raw.ignoreSensitive !== false,
    ignoredPatterns: Array.isArray(raw.ignoredPatterns)
      ? raw.ignoredPatterns.filter((pattern): pattern is string => typeof pattern === 'string').map(pattern => pattern.trim()).filter(Boolean).slice(0, 50)
      : [],
    hideAfterCopy: Boolean(raw.hideAfterCopy),
    autoDeleteDays: Math.round(clamp(raw.autoDeleteDays, 0, 365, defaultSettings.autoDeleteDays)),
    verificationCodeTtlMinutes: Math.round(clamp(raw.verificationCodeTtlMinutes, 0, 1440, defaultSettings.verificationCodeTtlMinutes)),
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
  return require('crypto').createHash('md5').update(buffer).digest('hex').substring(0, 16)
}

function isImageHistoryItem(item: ClipboardItem | undefined): item is ClipboardItem & { imagePath: string } {
  return item?.type === 'image' && typeof item.imagePath === 'string' && item.imagePath.length > 0
}

function getSafeImageDataUrl(imagePath: string | undefined) {
  if (!imagePath) return null
  try {
    const resolvedImagesDir = path.resolve(imagesDir)
    const resolvedImagePath = path.resolve(imagePath)
    if (!resolvedImagePath.startsWith(resolvedImagesDir + path.sep)) return null
    if (!fs.existsSync(resolvedImagePath)) return null
    const buffer = fs.readFileSync(resolvedImagePath)
    if (buffer.byteLength > 8 * 1024 * 1024) return null
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch (err) {
    console.error('Failed to read image data url:', err)
    return null
  }
}

function getImageInfo(imagePath: string | undefined) {
  if (!imagePath) return null
  try {
    const resolvedImagesDir = path.resolve(imagesDir)
    const resolvedImagePath = path.resolve(imagePath)
    if (!resolvedImagePath.startsWith(resolvedImagesDir + path.sep)) return null
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
    const used = new Set(
      clipboardHistory
        .map(item => item.imagePath)
        .filter((imagePath): imagePath is string => Boolean(imagePath))
        .map(imagePath => path.resolve(imagePath))
    )
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
    const resolvedImagesDir = path.resolve(imagesDir)
    const resolvedImagePath = path.resolve(imagePath)
    if (!resolvedImagePath.startsWith(resolvedImagesDir + path.sep)) return
    if (clipboardHistory.some(item => item.imagePath === imagePath)) return
    if (fs.existsSync(resolvedImagePath)) fs.unlinkSync(resolvedImagePath)
  } catch (err) {
    console.error('Failed to delete image file:', err)
  }
}

function removeHistoryItems(shouldRemove: (item: ClipboardItem) => boolean) {
  const removed: ClipboardItem[] = []
  clipboardHistory = clipboardHistory.filter(item => {
    if (shouldRemove(item)) {
      removed.push(item)
      return false
    }
    return true
  })
  removed.forEach(item => safeDeleteImageFile(item.imagePath))
  return removed
}

// 保存剪贴板图片
function saveClipboardImage(): { path: string; hash: string } | null {
  try {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null

    const buffer = image.toPNG()
    const hash = getImageHash(buffer)

    // 检查是否重复
    if (hash === lastClipboardImageHash) return null

    const imagePath = path.join(imagesDir, `${hash}.png`)
    if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, buffer)
    lastClipboardImageHash = hash
    return { path: imagePath, hash }
  } catch (err) {
    console.error('Failed to save clipboard image:', err)
    return null
  }
}

function sanitizeHistoryItem(item: any): ClipboardItem | null {
  if (!item || typeof item.content !== 'string' || !item.content.trim()) return null
  const timestamp = Number(item.timestamp)
  const safeTimestamp = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
  const rawType = typeof item.type === 'string' ? item.type : getClipboardContentType(item.content)
  const type = (CLIPBOARD_TYPES as readonly string[]).includes(rawType) ? rawType as ClipboardType : getClipboardContentType(item.content)
  return {
    id: typeof item.id === 'string' && item.id ? item.id : generateId(),
    content: item.content,
    type,
    timestamp: safeTimestamp,
    pinned: Boolean(item.pinned),
    favorited: Boolean(item.favorited),
    copyCount: Math.max(1, Number.isFinite(Number(item.copyCount)) ? Number(item.copyCount) : 1),
    firstTimestamp: Number.isFinite(Number(item.firstTimestamp)) ? Number(item.firstTimestamp) : safeTimestamp,
    imagePath: typeof item.imagePath === 'string' && item.imagePath ? item.imagePath : undefined,
    tags: Array.isArray(item.tags) ? item.tags.filter((tag: unknown) => typeof tag === 'string') : undefined,
  }
}

function getHistoryDedupeKey(item: ClipboardItem) {
  return `${item.type}:${item.content}`
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
  }
  return Array.from(byContent.values()).sort((a, b) => b.timestamp - a.timestamp)
}

function getImportedItems(payload: any) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.history)
        ? payload.history
        : []
  return source.map(sanitizeHistoryItem).filter(Boolean) as ClipboardItem[]
}

function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8')
      const data: Partial<AppData> = JSON.parse(raw)
      clipboardHistory = Array.isArray(data.history) ? data.history.map(sanitizeHistoryItem).filter(Boolean) as ClipboardItem[] : []
      settings = sanitizeSettings(data.settings)
      protectedToday = Number.isFinite(Number(data.protectedToday)) ? Number(data.protectedToday) : 0
      applyRetentionRules()
    }
  } catch (err) {
    console.error('Failed to load data:', err)
    try {
      if (fs.existsSync(backupPath)) {
        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8')) as Partial<AppData>
        clipboardHistory = Array.isArray(backup.history) ? backup.history.map(sanitizeHistoryItem).filter(Boolean) as ClipboardItem[] : []
        settings = sanitizeSettings(backup.settings)
      }
    } catch (backupErr) {
      console.error('Failed to load backup data:', backupErr)
    }
  }
}

function saveData() {
  try {
    const data: AppData = { history: clipboardHistory, settings, protectedToday }
    const tmpPath = `${dataPath}.${process.pid}.tmp`
    if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, backupPath)
    fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8')
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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function isVerificationCode(text: string) {
  return /^\d{4,8}$/.test(text.trim())
}

function isSensitiveClipboardContent(text: string) {
  const trimmed = text.trim()
  const patterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
    /\b(?:sk|pk|rk|ghp|github_pat|xox[baprs])-?[a-zA-Z0-9_\-]{20,}\b/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\b(?:password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/i,
    /\b\d{15,19}\b/,
    /\b\d{17}[\dXx]\b/,
  ]
  return patterns.some(pattern => pattern.test(trimmed))
}

function matchesIgnoredPattern(text: string) {
  const trimmed = text.trim()
  if (!trimmed || settings.ignoredPatterns.length === 0) return false
  return settings.ignoredPatterns.some(pattern => {
    try {
      return new RegExp(pattern, 'i').test(trimmed)
    } catch {
      return trimmed.toLowerCase().includes(pattern.toLowerCase())
    }
  })
}

function applyRetentionRules() {
  const now = Date.now()
  const normalMaxAge = settings.autoDeleteDays > 0 ? settings.autoDeleteDays * 24 * 60 * 60 * 1000 : Infinity
  const codeMaxAge = settings.verificationCodeTtlMinutes > 0 ? settings.verificationCodeTtlMinutes * 60 * 1000 : Infinity

  const retainedByAge = clipboardHistory.filter(item => {
    if (item.pinned || item.favorited) return true
    const age = now - item.timestamp
    if (isVerificationCode(item.content)) return age <= codeMaxAge
    return age <= normalMaxAge
  })

  const protectedItems = retainedByAge.filter(item => item.pinned || item.favorited)
  const normalItems = retainedByAge.filter(item => !item.pinned && !item.favorited)
  const maxNormal = Math.max(0, settings.maxHistory - protectedItems.length)
  const nextHistory = [...protectedItems, ...normalItems.slice(0, maxNormal)].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (a.favorited && !b.favorited) return -1
    if (!a.favorited && b.favorited) return 1
    return b.timestamp - a.timestamp
  })
  const nextIds = new Set(nextHistory.map(item => item.id))
  const removedImages = clipboardHistory
    .filter(item => !nextIds.has(item.id))
    .map(item => item.imagePath)
  clipboardHistory = nextHistory
  removedImages.forEach(safeDeleteImageFile)
}

function getPrivacyState() {
  return { paused: pauseUntil > Date.now(), pauseUntil, protectedToday }
}

function emitPrivacyState() {
  mainWindow?.webContents.send('privacy-updated', getPrivacyState())
}

function applyAutoStart() {
  try {
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      path: process.execPath,
    })
  } catch (err) {
    console.error('Failed to update auto start:', err)
  }
}

function registerHotkey(nextHotkey = settings.hotkey) {
  const hotkey = nextHotkey.trim()
  if (!hotkey) return false
  if (currentHotkey === hotkey) return true
  try {
    const ok = globalShortcut.register(hotkey, () => toggleWindow())
    if (!ok) {
      console.error(`Failed to register shortcut: ${hotkey}`)
      return false
    }
    if (currentHotkey) globalShortcut.unregister(currentHotkey)
    currentHotkey = hotkey
    return true
  } catch (err) {
    console.error('Failed to register shortcut:', err)
    return false
  }
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
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault()
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
  const paused = pauseUntil > Date.now()
  tray.setToolTip(getTrayText('tooltip'))
  const contextMenu = Menu.buildFromTemplate([
    { label: getTrayText('show'), click: () => toggleWindow() },
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
      flushPendingSave()
      app.quit()
    }}
  ])
  tray.setContextMenu(contextMenu)
}

function pauseMonitoring(minutes: number) {
  pauseUntil = Date.now() + minutes * 60 * 1000
  rebuildTrayMenu()
  emitPrivacyState()
}

function resumeMonitoring() {
  pauseUntil = 0
  rebuildTrayMenu()
  emitPrivacyState()
}

function showWindow() {
  if (!mainWindow) createWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

function toggleWindow() {
  if (mainWindow?.isVisible()) {
    mainWindow.hide()
  } else {
    showWindow()
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
      if (pauseUntil > 0 && pauseUntil <= Date.now()) resumeMonitoring()
      if (pauseUntil > Date.now()) return

      // 错误计数器重置：如果连续成功，重置错误计数
      let hasError = false

      // 检查文本内容
      let currentContent = ''
      try {
        currentContent = clipboard.readText()
      } catch (readErr) {
        console.error('Failed to read clipboard text:', readErr)
        hasError = true
      }

      if (currentContent && currentContent !== lastClipboardContent && matchesIgnoredPattern(currentContent)) {
        lastClipboardContent = currentContent
        protectedToday += 1
        emitPrivacyState()
        scheduleSave()
        return
      }

      if (settings.ignoreSensitive && currentContent && currentContent !== lastClipboardContent && isSensitiveClipboardContent(currentContent)) {
        lastClipboardContent = currentContent
        protectedToday += 1
        emitPrivacyState()
        scheduleSave()
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
      if (currentContent && currentContent !== lastClipboardContent) {
        lastClipboardContent = currentContent

        const existingIndex = clipboardHistory.findIndex(item => item.content === currentContent)
        if (existingIndex !== -1) {
          const existing = clipboardHistory.splice(existingIndex, 1)[0]
          existing.timestamp = Date.now()
          existing.copyCount = (existing.copyCount || 1) + 1
          clipboardHistory.unshift(existing)
        } else {
          const now = Date.now()
          clipboardHistory.unshift({
            id: generateId(),
            content: currentContent,
            type: getClipboardContentType(currentContent),
            timestamp: now,
            pinned: false,
            favorited: false,
            copyCount: 1,
            firstTimestamp: now,
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
          existing.timestamp = Date.now()
          existing.copyCount = (existing.copyCount || 1) + 1
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
ipcMain.handle('get-image-data-url', (_, imagePath: string | undefined) => getSafeImageDataUrl(imagePath))
ipcMain.handle('get-image-info', (_, imagePath: string | undefined) => getImageInfo(imagePath))
ipcMain.handle('cleanup-image-cache', () => cleanupImageCache())
ipcMain.handle('open-external-url', async (_, url: string) => {
  if (!canOpenExternalUrl(url)) return false
  await shell.openExternal(url.trim())
  return true
})
ipcMain.handle('show-file-in-folder', async (_, filePath: string) => {
  if (!canShowFilePath(filePath)) return false
  shell.showItemInFolder(filePath.trim())
  return true
})
ipcMain.handle('get-history', () => clipboardHistory)

ipcMain.handle('copy-to-clipboard', (_, itemOrContent: ClipboardItem | string) => {
  const finishCopy = () => {
    if (settings.hideAfterCopy) mainWindow?.hide()
  }

  if (typeof itemOrContent === 'string') {
    clipboard.writeText(itemOrContent)
    lastClipboardContent = itemOrContent
    finishCopy()
    return
  }

  if (isImageHistoryItem(itemOrContent) && fs.existsSync(itemOrContent.imagePath)) {
    const image = nativeImage.createFromPath(itemOrContent.imagePath)
    if (!image.isEmpty()) {
      clipboard.writeImage(image)
      lastClipboardImageHash = itemOrContent.content.replace(/^\[图片\]\s*/, '')
      lastImageCheckAt = Date.now()
      finishCopy()
      return
    }
  }

  clipboard.writeText(itemOrContent.content)
  lastClipboardContent = itemOrContent.content
  finishCopy()
})

ipcMain.handle('delete-item', (_, id: string) => {
  removeHistoryItems(item => item.id === id)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('toggle-pin', (_, id: string) => {
  const item = clipboardHistory.find(item => item.id === id)
  if (item) {
    item.pinned = !item.pinned
    applyRetentionRules()
  }
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('toggle-favorite', (_, id: string) => {
  const item = clipboardHistory.find(item => item.id === id)
  if (item) {
    item.favorited = !item.favorited
    applyRetentionRules()
  }
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('clear-history', () => {
  removeHistoryItems(item => !item.pinned && !item.favorited)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('clear-all-history', () => {
  removeHistoryItems(() => true)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('import-history', (_, payload: any, mode: 'merge' | 'replace' = 'merge') => {
  const imported = getImportedItems(payload)
  if (imported.length === 0) return { history: clipboardHistory, imported: 0 }

  if (mode === 'replace') {
    clipboardHistory = dedupeHistory(imported)
  } else {
    clipboardHistory = dedupeHistory([...imported, ...clipboardHistory])
  }

  const importedSettings = sanitizeSettings(payload?.settings)
  if (payload?.settings && typeof payload.settings === 'object') {
    const oldSettings = settings
    const nextSettings = { ...importedSettings, hotkey: oldSettings.hotkey }
    settings = nextSettings
    applyAutoStart()
    mainWindow?.webContents.send('settings-updated', settings)
  }

  applyRetentionRules()
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return { history: clipboardHistory, imported: imported.length }
})

ipcMain.handle('get-settings', () => settings)

ipcMain.handle('update-settings', (_, newSettings: Partial<Settings>) => {
  const oldSettings = settings
  const nextSettings = sanitizeSettings({ ...settings, ...newSettings })

  if (oldSettings.hotkey !== nextSettings.hotkey && !registerHotkey(nextSettings.hotkey)) {
    nextSettings.hotkey = oldSettings.hotkey
  }

  settings = nextSettings

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
ipcMain.handle('pause-monitoring', (_, minutes: number) => {
  pauseMonitoring(clamp(minutes, 1, 1440, 5))
  return getPrivacyState()
})
ipcMain.handle('resume-monitoring', () => {
  resumeMonitoring()
  return getPrivacyState()
})

ipcMain.handle('minimize-window', () => mainWindow?.minimize())
ipcMain.handle('close-window', () => mainWindow?.hide())
ipcMain.handle('toggle-maximize', () => {
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
app.whenReady().then(() => {
  loadData()
  applyAutoStart()
  createWindow()
  createTray()
  startClipboardWatcher()
  registerHotkey()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  flushPendingSave()
  stopClipboardWatcher()
  globalShortcut.unregisterAll()
})
