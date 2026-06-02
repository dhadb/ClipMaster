import { app, BrowserWindow, Tray, Menu, clipboard, globalShortcut, nativeImage, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let clipboardWatcher: ReturnType<typeof setInterval> | null = null
let lastClipboardContent = ''
let isQuitting = false

// === Persistence ===
const dataPath = path.join(app.getPath('userData'), 'clipmaster-data.json')

interface AppData {
  history: Array<{id: string, content: string, type: string, timestamp: number, pinned: boolean}>
  settings: typeof defaultSettings
}

const defaultSettings = {
  maxHistory: 200,
  hotkey: 'CommandOrControl+Shift+V',
  autoStart: true,
  minimizeToTray: true,
  theme: 'dark' as const,
  opacity: 0.95,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  copyOnSelect: true,
  soundEnabled: false,
}

let clipboardHistory: AppData['history'] = []
let settings = { ...defaultSettings }

function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8')
      const data: AppData = JSON.parse(raw)
      clipboardHistory = data.history || []
      settings = { ...defaultSettings, ...data.settings }
    }
  } catch (err) {
    console.error('Failed to load data:', err)
  }
}

function saveData() {
  try {
    const data: AppData = { history: clipboardHistory, settings }
    fs.writeFileSync(dataPath, JSON.stringify(data), 'utf-8')
  } catch (err) {
    console.error('Failed to save data:', err)
  }
}

// Save periodically and on quit
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveData, 1000)
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function getClipboardContentType(text: string): string {
  if (/^https?:\/\//i.test(text)) return 'link'
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(text)) return 'email'
  if (/^#[0-9a-f]{3,8}$/i.test(text) || /^rgb/i.test(text)) return 'color'
  if (/^[\d.,\s+\-*/()]+$/.test(text) && text.length < 50) return 'number'
  if (/[{}\[\]();]/.test(text) && (text.includes('function') || text.includes('=>') || text.includes('class') || text.includes('import') || text.includes('const ') || text.includes('let ') || text.includes('var '))) return 'code'
  if (text.length > 100) return 'long-text'
  return 'text'
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

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 ClipMaster', click: () => toggleWindow() },
    { type: 'separator' },
    { label: '清空历史', click: () => {
      clipboardHistory = clipboardHistory.filter(item => item.pinned)
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

  tray.setToolTip('ClipMaster - 剪贴板管理器')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => toggleWindow())
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
      const currentContent = clipboard.readText()
      if (currentContent && currentContent !== lastClipboardContent) {
        lastClipboardContent = currentContent

        const existingIndex = clipboardHistory.findIndex(item => item.content === currentContent)
        if (existingIndex !== -1) {
          const existing = clipboardHistory.splice(existingIndex, 1)[0]
          existing.timestamp = Date.now()
          clipboardHistory.unshift(existing)
        } else {
          clipboardHistory.unshift({
            id: generateId(),
            content: currentContent,
            type: getClipboardContentType(currentContent),
            timestamp: Date.now(),
            pinned: false,
          })
        }

        const pinnedItems = clipboardHistory.filter(item => item.pinned)
        const unpinnedItems = clipboardHistory.filter(item => !item.pinned)
        const maxUnpinned = settings.maxHistory - pinnedItems.length
        clipboardHistory = [...pinnedItems, ...unpinnedItems.slice(0, Math.max(0, maxUnpinned))]

        mainWindow?.webContents.send('history-updated', clipboardHistory)
        scheduleSave()
      }
    } catch (err) {
      // Clipboard may be locked by another app
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
    clipboardHistory.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.timestamp - a.timestamp
    })
  }
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('clear-history', () => {
  clipboardHistory = clipboardHistory.filter(item => item.pinned)
  mainWindow?.webContents.send('history-updated', clipboardHistory)
  scheduleSave()
  return clipboardHistory
})

ipcMain.handle('get-settings', () => settings)

ipcMain.handle('update-settings', (_, newSettings: Partial<typeof settings>) => {
  settings = { ...settings, ...newSettings }
  mainWindow?.webContents.send('settings-updated', settings)
  scheduleSave()
  // Resize window if size changed
  if (newSettings.windowWidth || newSettings.windowHeight) {
    mainWindow?.setSize(settings.windowWidth, settings.windowHeight)
  }
  return settings
})

ipcMain.handle('minimize-window', () => mainWindow?.minimize())
ipcMain.handle('close-window', () => mainWindow?.hide())
ipcMain.handle('toggle-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

// App lifecycle
app.whenReady().then(() => {
  loadData()
  createWindow()
  createTray()
  startClipboardWatcher()

  try {
    globalShortcut.register(settings.hotkey, () => toggleWindow())
  } catch (e) {
    console.log('Failed to register shortcut:', e)
  }
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
  saveData()
  if (clipboardWatcher) clearInterval(clipboardWatcher)
  globalShortcut.unregisterAll()
})
