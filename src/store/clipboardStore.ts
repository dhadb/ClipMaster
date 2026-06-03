import { create } from 'zustand'

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
  showSettings: boolean
  activeTab: 'history' | 'favorites' | 'stats' | 'settings'
  copiedId: string | null
  filterType: string | null
  _copiedTimer: any

  setHistory: (history: ClipboardItem[]) => void
  setSearchQuery: (query: string) => void
  setSelectedId: (id: string | null) => void
  setSettings: (settings: Settings) => void
  setShowSettings: (show: boolean) => void
  setActiveTab: (tab: 'history' | 'favorites' | 'stats' | 'settings') => void
  setFilterType: (type: string | null) => void
  deleteItem: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  copyItem: (id: string) => Promise<void>
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  history: [],
  filteredHistory: [],
  searchQuery: '',
  selectedId: null,
  settings: defaultSettings,
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
  setSettings: (settings) => set({ settings }),
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
        const { searchQuery, activeTab, filterType } = get()
        let filtered = filterHistory(newHistory, activeTab, searchQuery)
        if (filterType) filtered = filtered.filter(item => item.type === filterType)
        set({ history: newHistory, filteredHistory: filtered })
      }
    } catch (err) { console.error('deleteItem failed:', err) }
  },

  togglePin: async (id) => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.togglePin(id)
        const { searchQuery, activeTab, filterType } = get()
        let filtered = filterHistory(newHistory, activeTab, searchQuery)
        if (filterType) filtered = filtered.filter(item => item.type === filterType)
        set({ history: newHistory, filteredHistory: filtered })
      }
    } catch (err) { console.error('togglePin failed:', err) }
  },

  toggleFavorite: async (id) => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.toggleFavorite(id)
        const { searchQuery, activeTab, filterType } = get()
        let filtered = filterHistory(newHistory, activeTab, searchQuery)
        if (filterType) filtered = filtered.filter(item => item.type === filterType)
        set({ history: newHistory, filteredHistory: filtered })
      }
    } catch (err) { console.error('toggleFavorite failed:', err) }
  },

  clearHistory: async () => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.clearHistory()
        const { searchQuery, activeTab, filterType } = get()
        let filtered = filterHistory(newHistory, activeTab, searchQuery)
        if (filterType) filtered = filtered.filter(item => item.type === filterType)
        set({ history: newHistory, filteredHistory: filtered })
      }
    } catch (err) { console.error('clearHistory failed:', err) }
  },

  copyItem: async (id) => {
    const { history, _copiedTimer } = get()
    const item = history.find(h => h.id === id)
    if (!item || !window.electronAPI) return
    try {
      if (_copiedTimer) clearTimeout(_copiedTimer)
      await window.electronAPI.copyToClipboard(item.content)
      const timer = setTimeout(() => set({ copiedId: null, _copiedTimer: null }), 1000)
      set({ copiedId: id, _copiedTimer: timer })
    } catch (err) { console.error('copyItem failed:', err) }
  },
}))
