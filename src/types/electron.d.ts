import { ClipboardItem, Settings, PrivacyState } from '../store/clipboardStore'

export interface ClipboardItemDraft {
  content: string
  tags?: string[]
  pinned?: boolean
  favorited?: boolean
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  publishedAt: string | null
}

export interface ElectronAPI {
  getImageDataUrl: (imagePath?: string) => Promise<string | null>
  openExternalUrl: (url: string) => Promise<boolean>
  showFileInFolder: (filePath: string) => Promise<boolean>
  getHistory: () => Promise<ClipboardItem[]>
  getAppVersion: () => Promise<string>
  checkForUpdates: (force?: boolean) => Promise<UpdateInfo>
  copyToClipboard: (item: ClipboardItem | string) => Promise<ClipboardItem[]>
  createItem: (draft: ClipboardItemDraft) => Promise<{ history: ClipboardItem[]; itemId: string | null; created: boolean }>
  updateItemTags: (id: string, tags: string[]) => Promise<ClipboardItem[]>
  updateItem: (id: string, patch: { content?: string; tags?: string[] }) => Promise<ClipboardItem[]>
  deleteItem: (id: string) => Promise<ClipboardItem[]>
  deleteItems: (ids: string[]) => Promise<{ history: ClipboardItem[]; deleted: ClipboardItem[] }>
  restoreItems: (items: ClipboardItem[]) => Promise<ClipboardItem[]>
  batchUpdateItems: (ids: string[], patch: { pinned?: boolean; favorited?: boolean; addTags?: string[] }) => Promise<ClipboardItem[]>
  togglePin: (id: string) => Promise<ClipboardItem[]>
  toggleFavorite: (id: string) => Promise<ClipboardItem[]>
  clearHistory: () => Promise<ClipboardItem[]>
  getSettings: () => Promise<Settings>
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>
  getPrivacyState: () => Promise<PrivacyState>
  pauseMonitoring: (minutes: number) => Promise<PrivacyState>
  resumeMonitoring: () => Promise<PrivacyState>
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  toggleMaximize: () => Promise<void>
  getImageInfo: (imagePath?: string) => Promise<{ bytes: number; width: number; height: number } | null>
  cleanupImageCache: () => Promise<{ deleted: number; bytes: number }>
  clearAllHistory: () => Promise<ClipboardItem[]>
  importHistory: (payload: unknown, mode?: 'merge' | 'replace') => Promise<{ history: ClipboardItem[]; imported: number }>
  onHistoryUpdated: (callback: (history: ClipboardItem[]) => void) => () => void
  onSettingsUpdated: (callback: (settings: Settings) => void) => () => void
  onPrivacyUpdated: (callback: (state: PrivacyState) => void) => () => void
  onShowSettings: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
