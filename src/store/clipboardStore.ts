import { create } from 'zustand'

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
  opacity: number
  fontSize: number
  windowWidth: number
  windowHeight: number
  showPreview: boolean
  copyOnSelect: boolean
  soundEnabled: boolean
  ignoreSensitive: boolean
  autoDeleteDays: number
  verificationCodeTtlMinutes: number
}

export interface PrivacyState {
  paused: boolean
  pauseUntil: number
  protectedToday: number
}

const defaultSettings: Settings = {
  maxHistory: 200,
  hotkey: 'CommandOrControl+Shift+V',
  autoStart: true,
  minimizeToTray: true,
  theme: 'dark',
  opacity: 0.95,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  copyOnSelect: true,
  soundEnabled: false,
  ignoreSensitive: true,
  autoDeleteDays: 30,
  verificationCodeTtlMinutes: 10,
}

function filterHistory(history: ClipboardItem[], activeTab: string, searchQuery: string): ClipboardItem[] {
  let filtered = history
  if (activeTab === 'favorites') {
    filtered = filtered.filter(item => item.favorited)
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(item => item.content.toLowerCase().includes(q))
  }
  return filtered
}

interface ClipboardStore {
  history: ClipboardItem[]
  filteredHistory: ClipboardItem[]
  searchQuery: string
  selectedId: string | null
  settings: Settings
  privacy: PrivacyState
  showSettings: boolean
  activeTab: 'history' | 'favorites' | 'stats' | 'settings'
  copiedId: string | null
  filterType: string | null
  _copiedTimer: any

  setHistory: (history: ClipboardItem[]) => void
  setSearchQuery: (query: string) => void
  setSelectedId: (id: string | null) => void
  setSettings: (settings: Settings) => void
  setPrivacy: (privacy: PrivacyState) => void
  setShowSettings: (show: boolean) => void
  setActiveTab: (tab: 'history' | 'favorites' | 'stats' | 'settings') => void
  setFilterType: (type: string | null) => void
  deleteItem: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  copyItem: (id: string) => Promise<void>
  pauseMonitoring: (minutes: number) => Promise<void>
  resumeMonitoring: () => Promise<void>
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  history: [],
  filteredHistory: [],
  searchQuery: '',
  selectedId: null,
  settings: defaultSettings,
  privacy: { paused: false, pauseUntil: 0, protectedToday: 0 },
  showSettings: false,
  activeTab: 'history',
  copiedId: null,
  filterType: null,
  _copiedTimer: null,

  setHistory: (history) => {
    const { searchQuery, activeTab, filterType } = get()
    let filtered = filterHistory(history, activeTab, searchQuery)
    if (filterType) {
      filtered = filtered.filter(item => item.type === filterType)
    }
    set({ history, filteredHistory: filtered })
  },

  setSearchQuery: (searchQuery) => {
    const { history, activeTab, filterType } = get()
    let filtered = filterHistory(history, activeTab, searchQuery)
    if (filterType) {
      filtered = filtered.filter(item => item.type === filterType)
    }
    set({ searchQuery, filteredHistory: filtered })
  },

  setSelectedId: (selectedId) => set({ selectedId }),
  setSettings: (settings) => set({ settings: { ...defaultSettings, ...settings } }),
  setPrivacy: (privacy) => set({ privacy }),
  setShowSettings: (showSettings) => set({ showSettings }),

  setActiveTab: (activeTab) => {
    const { history, searchQuery, filterType } = get()
    let filtered = filterHistory(history, activeTab, searchQuery)
    if (filterType) {
      filtered = filtered.filter(item => item.type === filterType)
    }
    set({ activeTab, showSettings: activeTab === 'settings', filteredHistory: filtered })
  },

  setFilterType: (filterType) => {
    const { history, searchQuery, activeTab } = get()
    let filtered = filterHistory(history, activeTab, searchQuery)
    if (filterType) {
      filtered = filtered.filter(item => item.type === filterType)
    }
    set({ filterType, filteredHistory: filtered })
  },

  deleteItem: async (id) => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.deleteItem(id)
        get().setHistory(newHistory)
      }
    } catch (err) { console.error('deleteItem failed:', err) }
  },

  togglePin: async (id) => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.togglePin(id)
        get().setHistory(newHistory)
      }
    } catch (err) { console.error('togglePin failed:', err) }
  },

  toggleFavorite: async (id) => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.toggleFavorite(id)
        get().setHistory(newHistory)
      }
    } catch (err) { console.error('toggleFavorite failed:', err) }
  },

  clearHistory: async () => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.clearHistory()
        get().setHistory(newHistory)
      }
    } catch (err) { console.error('clearHistory failed:', err) }
  },

  copyItem: async (id) => {
    const { history, _copiedTimer, settings } = get()
    const item = history.find(h => h.id === id)
    if (!item || !window.electronAPI) return
    try {
      if (_copiedTimer) clearTimeout(_copiedTimer)
      await window.electronAPI.copyToClipboard(item)
      if (settings.soundEnabled) {
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YRAAAAAAAP//AAD//wAA//8AAP//AAA=')
          audio.volume = 0.12
          audio.play().catch(() => {})
        } catch {}
      }
      const timer = setTimeout(() => set({ copiedId: null, _copiedTimer: null }), 1000)
      set({ copiedId: id, _copiedTimer: timer })
    } catch (err) { console.error('copyItem failed:', err) }
  },

  pauseMonitoring: async (minutes) => {
    try {
      if (window.electronAPI) {
        const state = await window.electronAPI.pauseMonitoring(minutes)
        set({ privacy: state })
      }
    } catch (err) { console.error('pauseMonitoring failed:', err) }
  },

  resumeMonitoring: async () => {
    try {
      if (window.electronAPI) {
        const state = await window.electronAPI.resumeMonitoring()
        set({ privacy: state })
      }
    } catch (err) { console.error('resumeMonitoring failed:', err) }
  },
}))
