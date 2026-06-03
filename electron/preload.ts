import { contextBridge, ipcRenderer } from 'electron'

export interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'link' | 'email' | 'color' | 'number' | 'code' | 'long-text'
  timestamp: number
  pinned: boolean
  favorited: boolean
}

export interface Settings {
  maxHistory: number
  hotkey: string
  autoStart: boolean
  minimizeToTray: boolean
  theme: 'dark' | 'light' | 'auto'
  opacity: number
  fontSize: number
  windowWidth: number
  windowHeight: number
  showPreview: boolean
  copyOnSelect: boolean
  soundEnabled: boolean
}

const electronAPI = {
  getHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('get-history'),
  copyToClipboard: (content: string): Promise<void> => ipcRenderer.invoke('copy-to-clipboard', content),
  deleteItem: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('delete-item', id),
  togglePin: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('toggle-pin', id),
  toggleFavorite: (id: string): Promise<ClipboardItem[]> => ipcRenderer.invoke('toggle-favorite', id),
  clearHistory: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('clear-history'),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('update-settings', settings),
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
  onShowSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('show-settings', handler)
    return () => { ipcRenderer.removeListener('show-settings', handler) }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
