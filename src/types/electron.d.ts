import { ClipboardItem, Settings } from '../store/clipboardStore'

export interface ElectronAPI {
  getHistory: () => Promise<ClipboardItem[]>
  copyToClipboard: (content: string) => Promise<void>
  deleteItem: (id: string) => Promise<ClipboardItem[]>
  togglePin: (id: string) => Promise<ClipboardItem[]>
  clearHistory: () => Promise<ClipboardItem[]>
  searchHistory: (query: string) => Promise<ClipboardItem[]>
  getSettings: () => Promise<Settings>
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  toggleMaximize: () => Promise<void>
  onHistoryUpdated: (callback: (history: ClipboardItem[]) => void) => () => void
  onSettingsUpdated: (callback: (settings: Settings) => void) => () => void
  onShowSettings: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
