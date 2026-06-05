import { contextBridge, ipcRenderer } from 'electron'

export interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'link' | 'email' | 'color' | 'number' | 'code' | 'long-text' | 'json' | 'markdown' | 'file-path' | 'phone' | 'image'
  timestamp: number
  pinned: boolean
  favorited: boolean
  copyCount: number
  firstTimestamp: number
  imagePath?: string
  tags?: string[]
}

export interface Settings {
  maxHistory: number
  hotkey: string
  autoStart: boolean
  minimizeToTray: boolean
  theme: 'dark' | 'light' | 'auto'
  language: 'system' | 'zh-CN' | 'en-US'
  opacity: number
  fontSize: number
  windowWidth: number
  windowHeight: number
  showPreview: boolean
  showShortcutHints: boolean
  listDensity: 'compact' | 'normal' | 'comfortable'
  copyOnSelect: boolean
  recordImages: boolean
  soundEnabled: boolean
  ignoreSensitive: boolean
  ignoredPatterns: string[]
  hideAfterCopy: boolean
  autoDeleteDays: number
  verificationCodeTtlMinutes: number
}

export interface PrivacyState {
  paused: boolean
  pauseUntil: number
  protectedToday: number
}

const electronAPI = {
  getImageDataUrl: (imagePath?: string): Promise<string | null> => ipcRenderer.invoke('get-image-data-url', imagePath),
  getImageInfo: (imagePath?: string): Promise<{ bytes: number; width: number; height: number } | null> => ipcRenderer.invoke('get-image-info', imagePath),
  cleanupImageCache: (): Promise<{ deleted: number; bytes: number }> => ipcRenderer.invoke('cleanup-image-cache'),
  openExternalUrl: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external-url', url),
  showFileInFolder: (filePath: string): Promise<boolean> => ipcRenderer.invoke('show-file-in-folder', filePath),
  getHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('get-history'),
  copyToClipboard: (item: ClipboardItem | string): Promise<void> => ipcRenderer.invoke('copy-to-clipboard', item),
  deleteItem: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('delete-item', id),
  togglePin: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('toggle-pin', id),
  toggleFavorite: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('toggle-favorite', id),
  clearHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('clear-history'),
  clearAllHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('clear-all-history'),
  importHistory: (payload: unknown, mode: 'merge' | 'replace' = 'merge'): Promise<{ history: ClipboardItem[]; imported: number }> => ipcRenderer.invoke('import-history', payload, mode),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('update-settings', settings),
  getPrivacyState: (): Promise<PrivacyState> => ipcRenderer.invoke('get-privacy-state'),
  pauseMonitoring: (minutes: number): Promise<PrivacyState> => ipcRenderer.invoke('pause-monitoring', minutes),
  resumeMonitoring: (): Promise<PrivacyState> => ipcRenderer.invoke('resume-monitoring'),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('minimize-window'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('close-window'),
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke('toggle-maximize'),
  onHistoryUpdated: (callback: (history: ClipboardItem[]) => void) => {
    const handler = (_: any, history: ClipboardItem[]) => callback(history)
    ipcRenderer.on('history-updated', handler)
    return () => { ipcRenderer.removeListener('history-updated', handler) }
  },
  onSettingsUpdated: (callback: (settings: Settings) => void) => {
    const handler = (_: any, settings: Settings) => callback(settings)
    ipcRenderer.on('settings-updated', handler)
    return () => { ipcRenderer.removeListener('settings-updated', handler) }
  },
  onPrivacyUpdated: (callback: (state: PrivacyState) => void) => {
    const handler = (_: any, state: PrivacyState) => callback(state)
    ipcRenderer.on('privacy-updated', handler)
    return () => { ipcRenderer.removeListener('privacy-updated', handler) }
  },
  onShowSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('show-settings', handler)
    return () => { ipcRenderer.removeListener('show-settings', handler) }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
