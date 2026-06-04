import { ClipboardItem, Settings, PrivacyState } from '../store/clipboardStore'

export interface ElectronAPI {
  getImageDataUrl: (imagePath?: string) => Promise<string | null>
  openExternalUrl: (url: string) => Promise<boolean>
  showFileInFolder: (filePath: string) => Promise<boolean>
  getHistory: () => Promise<ClipboardItem[]>
  copyToClipboard: (item: ClipboardItem | string) => Promise<void>
  deleteItem: (id: string) => Promise<ClipboardItem[]>
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
