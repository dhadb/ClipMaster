import { ClipboardItem, Settings, PrivacyState } from '../store/clipboardStore'

export interface ElectronAPI {
  getHistory: () => Promise<ClipboardItem[]>
  copyToClipboard: (content: string) => Promise<void>
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
