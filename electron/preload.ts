import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ThemeSetting } from '../src/theme'
import type { AccentSetting } from '../src/personalization'
import type { ClipboardItem } from '../src/types/clipboard'

export interface Settings {
  maxHistory: number
  hotkey: string
  searchHotkey: string
  clearHotkey: string
  autoStart: boolean
  minimizeToTray: boolean
  theme: ThemeSetting
  accentColor: AccentSetting
  language: 'system' | 'zh-CN' | 'en-US'
  opacity: number
  fontSize: number
  windowWidth: number
  windowHeight: number
  showPreview: boolean
  listDensity: 'compact' | 'normal' | 'comfortable'
  copyOnSelect: boolean
  recordImages: boolean
  soundEnabled: boolean
  ignoreSensitive: boolean
  ignoredPatterns: string[]
  hideAfterCopy: boolean
  quickPaste: boolean
  recentSearches: string[]
  savedFilters: Array<{ id: string; label: string; query: string; filterType: string | null; timeFilter: 'all' | 'today' | 'week'; sortMode: 'newest' | 'oldest' | 'most-used' }>
  autoDeleteDays: number
  verificationCodeTtlMinutes: number
  autoCheckUpdates: boolean
}

export interface PrivacyState {
  paused: boolean
  pauseUntil: number
  pauseMode: 'timed' | 'until-resume' | 'application' | null
  protectedToday: number
}

export interface ClipboardItemDraft {
  content: string
  tags?: string[]
  pinned?: boolean
  favorited?: boolean
}

export interface DeleteItemsResult {
  history: ClipboardItem[]
  deleted: ClipboardItem[]
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  downloadUrl: string
  releaseNotes: string
  publishedAt: string | null
}

export interface UpdateDownloadProgress {
  receivedBytes: number
  totalBytes: number | null
  percent: number | null
}

export interface DataSecurityStatus {
  available: boolean
  active: boolean
  migrating: boolean
}

const electronAPI = {
  getImageDataUrl: (imagePath?: string, size: 'thumb' | 'detail' = 'thumb'): Promise<string | null> => ipcRenderer.invoke('get-image-data-url', imagePath, size),
  getImageInfo: (imagePath?: string): Promise<{ bytes: number; width: number; height: number } | null> => ipcRenderer.invoke('get-image-info', imagePath),
  cleanupImageCache: (): Promise<{ deleted: number; bytes: number }> => ipcRenderer.invoke('cleanup-image-cache'),
  openExternalUrl: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external-url', url),
  showFileInFolder: (filePath: string): Promise<boolean> => ipcRenderer.invoke('show-file-in-folder', filePath),
  getHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('get-history'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  getDataSecurityStatus: (): Promise<DataSecurityStatus> => ipcRenderer.invoke('get-data-security-status'),
  checkForUpdates: (force = false): Promise<UpdateInfo> => ipcRenderer.invoke('check-for-updates', force),
  downloadUpdate: (): Promise<{ version: string }> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<{ version: string }> => ipcRenderer.invoke('install-update'),
  copyToClipboard: (item: ClipboardItem | string, options?: { pasteAfterCopy?: boolean }): Promise<ClipboardItem[]> => ipcRenderer.invoke('copy-to-clipboard', item, options),
  createItem: (draft: ClipboardItemDraft): Promise<{ history: ClipboardItem[]; itemId: string | null; created: boolean }> => ipcRenderer.invoke('create-item', draft),
  updateItemTags: (id: string, tags: string[]): Promise<ClipboardItem[]> => ipcRenderer.invoke('update-item-tags', id, tags),
  updateItem: (id: string, patch: { content?: string; tags?: string[]; workspace?: string }): Promise<ClipboardItem[]> => ipcRenderer.invoke('update-item', id, patch),
  deleteItem: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('delete-item', id),
  deleteItems: (ids: string[]): Promise<DeleteItemsResult> => ipcRenderer.invoke('delete-items', ids),
  restoreItems: (items: ClipboardItem[]): Promise<ClipboardItem[]> => ipcRenderer.invoke('restore-items', items),
  batchUpdateItems: (ids: string[], patch: { pinned?: boolean; favorited?: boolean; addTags?: string[] }): Promise<ClipboardItem[]> => ipcRenderer.invoke('batch-update-items', ids, patch),
  togglePin: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('toggle-pin', id),
  toggleFavorite: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('toggle-favorite', id),
  clearHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('clear-history'),
  clearAllHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('clear-all-history'),
  importHistory: (payload: unknown, mode: 'merge' | 'replace' = 'merge'): Promise<{ history: ClipboardItem[]; imported: number }> => ipcRenderer.invoke('import-history', payload, mode),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('update-settings', settings),
  getPrivacyState: (): Promise<PrivacyState> => ipcRenderer.invoke('get-privacy-state'),
  pauseMonitoring: (mode: number | 'until-resume' | 'current-application'): Promise<PrivacyState> => ipcRenderer.invoke('pause-monitoring', mode),
  resumeMonitoring: (): Promise<PrivacyState> => ipcRenderer.invoke('resume-monitoring'),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('minimize-window'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('close-window'),
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke('toggle-maximize'),
  onHistoryUpdated: (callback: (history: ClipboardItem[]) => void) => {
    const handler = (_event: IpcRendererEvent, history: ClipboardItem[]) => callback(history)
    ipcRenderer.on('history-updated', handler)
    return () => { ipcRenderer.removeListener('history-updated', handler) }
  },
  onSettingsUpdated: (callback: (settings: Settings) => void) => {
    const handler = (_event: IpcRendererEvent, settings: Settings) => callback(settings)
    ipcRenderer.on('settings-updated', handler)
    return () => { ipcRenderer.removeListener('settings-updated', handler) }
  },
  onPrivacyUpdated: (callback: (state: PrivacyState) => void) => {
    const handler = (_event: IpcRendererEvent, state: PrivacyState) => callback(state)
    ipcRenderer.on('privacy-updated', handler)
    return () => { ipcRenderer.removeListener('privacy-updated', handler) }
  },
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: UpdateDownloadProgress) => callback(progress)
    ipcRenderer.on('update-download-progress', handler)
    return () => { ipcRenderer.removeListener('update-download-progress', handler) }
  },
  onFocusSearch: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('focus-search', handler)
    return () => { ipcRenderer.removeListener('focus-search', handler) }
  },
  onShowSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('show-settings', handler)
    return () => { ipcRenderer.removeListener('show-settings', handler) }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
