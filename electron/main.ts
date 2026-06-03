import { app, BrowserWindow, Tray, Menu, clipboard, globalShortcut, nativeImage, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let clipboardWatcher: ReturnType<typeof setInterval> | null = null
let lastClipboardContent = ''
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

const CLIPBOARD_TYPES = ['text', 'link', 'email', 'color', 'number', 'code', 'long-text', 'json', 'markdown', 'file-path', 'phone'] as const
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
}

const defaultSettings = {
  maxHistory: 200,
  hotkey: 'CommandOrControl+Shift+V',
  autoStart: true,
  minimizeToTray: true,
  theme: 'dark' as 'dark' | 'light' | 'auto',
  opacity: 0.95,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  copyOnSelect: true,
  soundEnabled: false,
  ignoreSensitive: true,
  autoDeleteDays: 30,
  verificationCodeTtlMinutes: 10,
}

type Settings = typeof defaultSettings

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
    opacity: clamp(raw.opacity, 0.7, 1, defaultSettings.opacity),
    fontSize: Math.round(clamp(raw.fontSize, 12, 18, defaultSettings.fontSize)),
    windowWidth: Math.round(clamp(raw.windowWidth, 350, 600, defaultSettings.windowWidth)),
    windowHeight: Math.round(clamp(raw.windowHeight, 400, 800, defaultSettings.windowHeight)),
    showPreview: Boolean(raw.showPreview),
    copyOnSelect: Boolean(raw.copyOnSelect),
    soundEnabled: Boolean(raw.soundEnabled),
    ignoreSensitive: raw.ignoreSensitive !== false,
    autoDeleteDays: Math.round(clamp(raw.autoDeleteDays, 0, 365, defaultSettings.autoDeleteDays)),
    verificationCodeTtlMinutes: Math.round(clamp(raw.verificationCodeTtlMinutes, 0, 1440, defaultSettings.verificationCodeTtlMinutes)),
  }
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
  }
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
  saveTimer = setTimeout(saveData, 1000)
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
  return isVerificationCode(trimmed) || patterns.some(pattern => pattern.test(trimmed))
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
  clipboardHistory = [...protectedItems, ...normalItems.slice(0, maxNormal)].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (a.favorited && !b.favorited) return -1
    if (!a.favorited && b.favorited) return 1
    return b.timestamp - a.timestamp
  })
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

function registerHotkey() {
  try {
    if (currentHotkey) globalShortcut.unregister(currentHotkey)
    currentHotkey = settings.hotkey
    const ok = globalShortcut.register(settings.hotkey, () => toggleWindow())
    if (!ok) console.error(`Failed to register shortcut: ${settings.hotkey}`)
  } catch (err) {
    console.error('Failed to register shortcut:', err)
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
  tray.setToolTip('ClipMaster - 剪贴板管理器')
  tray.on('click', () => toggleWindow())
}

function rebuildTrayMenu() {
  if (!tray) return
  const paused = pauseUntil > Date.now()
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 ClipMaster', click: () => toggleWindow() },
    { type: 'separator' },
    { label: paused ? '恢复记录' : '暂停记录 5 分钟', click: () => paused ? resumeMonitoring() : pauseMonitoring(5) },
    { label: '暂停记录 30 分钟', click: () => pauseMonitoring(30) },
    { type: 'separator' },
    { label: '清空历史', click: () => {
      clipboardHistory = clipboardHistory.filter(item => item.pinned || item.favorited)
      mainWindow?.webContents.send('history-updated', clipboardHistory)
      scheduleSave()
    }},
    { type: 'separator' },
    { label: '设置', click: () => {
      mainWindow?.webContents.send('show-settings')
      showWindow()
    }},
    { type: 'separator' },
    { label: '退出', click: () => {
      isQuitting = true
      saveData()
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

function startClipboardWatcher() {
  clipboardWatcher = setInterval(() => {
    try {
      if (pauseUntil > 0 && pauseUntil <= Date.now()) resumeMonitoring()
      if (pauseUntil > Date.now()) return

      const currentContent = clipboard.readText()
      if (currentContent && currentContent !== lastClipboardContent) {
        lastClipboardContent = currentContent

        if (settings.ignoreSensitive && isSensitiveClipboardContent(currentContent)) {
          protectedToday += 1
          emitPrivacyState()
          scheduleSave()
          return
        }

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
    } catch (err) {
      console.error('Clipboard watcher failed:', err)
    }
  }, 300)
}

// IPC Handlers
ipcMain.handle('get-history', () => clipboardHistory)

ipcMain.handle('copy-to-clipboard', (_, content: string) => {
  clipboard.writeText(content)
  lastClipboardContent = content
})

ipcMain.handle('delete-item', (_, id: string) => {
  clipboardHistory = clipboardHistory.filter(item => item.id !== id)
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
  clipboardHistory = clipboardHistory.filter(item => item.pinned || item.favorited)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('get-settings', () => settings)

ipcMain.handle('update-settings', (_, newSettings: Partial<Settings>) => {
  const oldSettings = settings
  settings = sanitizeSettings({ ...settings, ...newSettings })

  if (oldSettings.autoStart !== settings.autoStart) applyAutoStart()
  if (oldSettings.hotkey !== settings.hotkey) registerHotkey()
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
  if (saveTimer) clearTimeout(saveTimer)
  saveData()
  if (clipboardWatcher) clearInterval(clipboardWatcher)
  globalShortcut.unregisterAll()
})
