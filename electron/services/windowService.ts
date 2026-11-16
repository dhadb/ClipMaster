import { BrowserWindow, dialog, screen } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import type { ViewMode } from '../../shared/ipc-contract'
import { WINDOW_MODE_SIZES } from './runtime'
import type { AppServices } from './index'

export interface WindowService {
  createWindow(): BrowserWindow
  showWindow(mode?: ViewMode): Promise<void>
  toggleWindow(mode?: ViewMode): void
  applyWindowMode(mode: ViewMode): void
  hideMainWindow(): void
  minimizeWindow(): void
  closeWindow(): void
  toggleMaximize(): void
}

export function createWindowService(services: AppServices): WindowService {
  const rt = services.runtime

  function createWindow(): BrowserWindow {
    const workArea = screen.getPrimaryDisplay().workArea
    const width = Math.min(rt.settings.windowWidth, Math.max(1, workArea.width - 32))
    const height = Math.min(rt.settings.windowHeight, Math.max(1, workArea.height - 32))
    const iconPath = rt.isDev
      ? path.join(__dirname, '../public/icon.ico')
      : path.join(__dirname, '../dist/icon.ico')

    const mainWindow = rt.mainWindow = new BrowserWindow({
      width,
      height,
      x: workArea.x + workArea.width - width - 16,
      y: workArea.y + workArea.height - height - 16,
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
      if (services.image.canOpenExternalUrl(url)) void services.shell.openExternal(url)
      return { action: 'deny' }
    })

    // 导航白名单：dev 放行 Vite dev server；打包态只允许应用自身入口页（origin+pathname
    // 精确比较，hash/search 不影响）。放行任意外地 URL 会把 preload 重新注入的
    // electronAPI（全部 IPC 通道）交给该页面，因此这里必须拦死。
    const isAllowedNavigationUrl = (url: string) => {
      if (rt.isDev) return url === 'http://localhost:5173' || url.startsWith('http://localhost:5173/')
      try {
        const parsed = new URL(url)
        const entry = new URL(pathToFileURL(path.resolve(__dirname, '../dist/index.html')).toString())
        return parsed.origin === entry.origin && parsed.pathname === entry.pathname
      } catch {
        return false
      }
    }
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!isAllowedNavigationUrl(url)) event.preventDefault()
    })
    mainWindow.webContents.on('will-redirect', (event, url) => {
      if (!isAllowedNavigationUrl(url)) event.preventDefault()
    })
    mainWindow.webContents.on('will-attach-webview', event => {
      event.preventDefault()
    })

    // 渲染进程崩溃兜底（P2）：非退出状态下记录并自动重建主窗口。
    // 用计数 + 时间窗防无限循环：2 分钟内连续崩溃超过 3 次就不再重建，避免反复崩。
    let renderCrashCount = 0
    let renderCrashWindowStart = 0
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('Renderer process gone:', details.reason, details.exitCode)
      rt.storageHealth.lastError = `Renderer process gone: ${details.reason} (exitCode ${details.exitCode})`
      if (rt.isQuitting) return
      const now = rt.now()
      if (now - renderCrashWindowStart > 120_000) {
        renderCrashWindowStart = now
        renderCrashCount = 0
      }
      renderCrashCount += 1
      if (renderCrashCount > 3) {
        console.error('Renderer keeps crashing; skip auto-recreate to avoid a crash loop.')
        return
      }
      try {
        const crashedWindow = rt.mainWindow
        rt.mainWindow = null
        if (crashedWindow && !crashedWindow.isDestroyed()) crashedWindow.destroy()
        const recreated = createWindow()
        recreated.once('ready-to-show', () => {
          void showWindow()
        })
      } catch (err) {
        console.error('Failed to recreate window after renderer crash:', err)
      }
    })

    // 渲染进程无响应兜底（P2）：记录；30s 仍未恢复再提示用户，恢复则撤销，避免误报。
    let unresponsiveTimer: NodeJS.Timeout | null = null
    mainWindow.webContents.on('unresponsive', () => {
      console.warn('Renderer process is unresponsive.')
      rt.storageHealth.lastError = 'Renderer process is unresponsive'
      if (unresponsiveTimer) return
      unresponsiveTimer = setTimeout(() => {
        unresponsiveTimer = null
        if (rt.isQuitting) return
        dialog.showErrorBox('ClipMaster', '界面暂时没有响应，正在等待恢复。')
      }, 30_000)
      unresponsiveTimer.unref?.()
    })
    mainWindow.webContents.on('responsive', () => {
      if (unresponsiveTimer) {
        clearTimeout(unresponsiveTimer)
        unresponsiveTimer = null
      }
    })

    if (rt.isDev) {
      void mainWindow.loadURL('http://localhost:5173')
    } else {
      void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    mainWindow.on('blur', () => {
      rt.quickPasteTarget = null
      if (rt.settings.minimizeToTray && rt.mainWindow && !rt.mainWindow.webContents.isDevToolsOpened()) {
        rt.mainWindow.hide()
      }
    })

    mainWindow.on('close', e => {
      if (!rt.isQuitting && rt.settings.minimizeToTray) {
        e.preventDefault()
        rt.quickPasteTarget = null
        rt.mainWindow?.hide()
      }
    })

    mainWindow.on('closed', () => { rt.mainWindow = null })
    return mainWindow
  }

  function applyWindowMode(mode: ViewMode) {
    if (!rt.mainWindow) return
    if (rt.isMaximized) {
      rt.isMaximized = false
      rt.savedBounds = null
    }
    const sizes = WINDOW_MODE_SIZES[mode] ?? WINDOW_MODE_SIZES.library
    const targetSize = sizes.target

    const display = screen.getDisplayMatching(rt.mainWindow.getBounds())
    const margin = 16
    const availableWidth = Math.max(1, display.workArea.width - margin * 2)
    const availableHeight = Math.max(1, display.workArea.height - margin * 2)
    const minimumSize = sizes.minimum
    const minimumWidth = Math.min(minimumSize.width, availableWidth)
    const minimumHeight = Math.min(minimumSize.height, availableHeight)
    const width = Math.min(Math.max(targetSize.width, minimumWidth), availableWidth)
    const height = Math.min(Math.max(targetSize.height, minimumHeight), availableHeight)
    const currentBounds = rt.mainWindow.getBounds()
    const x = Math.min(
      Math.max(currentBounds.x, display.workArea.x + margin),
      display.workArea.x + display.workArea.width - width - margin,
    )
    const y = Math.min(
      Math.max(currentBounds.y, display.workArea.y + margin),
      display.workArea.y + display.workArea.height - height - margin,
    )

    rt.mainWindow.setMinimumSize(minimumWidth, minimumHeight)
    rt.mainWindow.setBounds({ x, y, width, height }, true)
    rt.mainWindow.webContents.send('window-mode', mode)
  }

  async function showWindow(mode: ViewMode = 'library') {
    if (rt.mainWindow?.isVisible()) {
      applyWindowMode(mode)
      rt.mainWindow.focus()
      return
    }
    if (rt.showWindowPromise) return rt.showWindowPromise
    if (!rt.mainWindow) createWindow()

    rt.showWindowPromise = (async () => {
      await services.quickPaste.captureQuickPasteTarget()
      applyWindowMode(mode)
      rt.mainWindow?.show()
      rt.mainWindow?.focus()
    })().finally(() => {
      rt.showWindowPromise = null
    })
    return rt.showWindowPromise
  }

  function toggleWindow(mode: ViewMode = 'quick') {
    if (rt.mainWindow?.isVisible()) {
      rt.quickPasteTarget = null
      rt.mainWindow.hide()
    } else {
      void showWindow(mode)
    }
  }

  function hideMainWindow() {
    rt.mainWindow?.hide()
  }

  function minimizeWindow() {
    if (!rt.mainWindow) return
    if (rt.settings.minimizeToTray) rt.mainWindow.hide()
    else rt.mainWindow.minimize()
  }

  function closeWindow() {
    rt.mainWindow?.close()
  }

  function toggleMaximize() {
    if (!rt.mainWindow) return
    if (rt.isMaximized) {
      if (rt.savedBounds) {
        rt.mainWindow.setBounds(rt.savedBounds)
      } else {
        rt.mainWindow.unmaximize()
      }
      rt.isMaximized = false
    } else {
      rt.savedBounds = rt.mainWindow.getBounds()
      const workArea = screen.getDisplayMatching(rt.savedBounds).workArea
      rt.mainWindow.setBounds(workArea)
      rt.isMaximized = true
    }
  }

  return {
    createWindow,
    showWindow,
    toggleWindow,
    applyWindowMode,
    hideMainWindow,
    minimizeWindow,
    closeWindow,
    toggleMaximize,
  }
}
