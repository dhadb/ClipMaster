import { Menu, nativeImage, Tray, app } from 'electron'
import path from 'path'
import type { AppServices } from './index'

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

export interface TrayService {
  createTray(): void
  rebuildMenu(): void
}

export function createTrayService(services: AppServices): TrayService {
  const rt = services.runtime

  function getResolvedLanguage(): ResolvedLanguage {
    if (rt.settings.language === 'zh-CN' || rt.settings.language === 'en-US') return rt.settings.language
    return app.getLocale().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
  }

  function getTrayText(key: keyof typeof trayTranslations['zh-CN']) {
    return trayTranslations[getResolvedLanguage()][key]
  }

  function createTray() {
    const trayIconPath = rt.isDev
      ? path.join(__dirname, '../public/icon.ico')
      : path.join(__dirname, '../dist/icon.ico')
    const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 })
    rt.tray = new Tray(icon)
    rebuildMenu()
    rt.tray.on('click', () => services.window.toggleWindow())
  }

  function rebuildMenu() {
    if (!rt.tray) return
    const paused = services.privacy.isMonitoringPaused()
    rt.tray.setToolTip(getTrayText('tooltip'))
    const contextMenu = Menu.buildFromTemplate([
      { label: getTrayText('show'), click: () => services.window.toggleWindow('library') },
      { label: getTrayText('search'), click: () => {
        void services.window.showWindow('library').then(() => rt.sendToRenderer('focus-search'))
      } },
      { type: 'separator' },
      { label: paused ? getTrayText('resume') : getTrayText('pause5'), click: () => paused ? services.privacy.resumeMonitoring() : services.privacy.pauseMonitoring(5) },
      { label: getTrayText('pause30'), click: () => services.privacy.pauseMonitoring(30) },
      { type: 'separator' },
      { label: getTrayText('clear'), click: () => {
        services.history.removeHistoryItems(item => !item.pinned && !item.favorited)
        rt.sendToRenderer('history-updated', rt.history)
        services.storage.scheduleSave()
      }},
      { type: 'separator' },
      { label: getTrayText('settings'), click: () => {
        rt.sendToRenderer('show-settings')
        void services.window.showWindow('library')
      }},
      { type: 'separator' },
      { label: getTrayText('quit'), click: () => {
        rt.isQuitting = true
        services.monitor.stop()
        services.foreground.stopTracker()
        services.storage.flushPendingSave()
        app.quit()
      }}
    ])
    rt.tray.setContextMenu(contextMenu)
  }

  return { createTray, rebuildMenu }
}
