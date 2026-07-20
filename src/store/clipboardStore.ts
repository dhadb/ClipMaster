import { create } from 'zustand'
import type { LanguageSetting } from '../i18n'
import { matchesClipboardQuery, normalizeTags } from '../utils/clipboard'

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
  language: LanguageSetting
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

export interface ClipboardItemDraft {
  content: string
  tags?: string[]
  pinned?: boolean
  favorited?: boolean
}

type ActiveTab = 'history' | 'favorites' | 'stats' | 'settings'

const defaultSettings: Settings = {
  maxHistory: 200,
  hotkey: 'CommandOrControl+Shift+V',
  autoStart: true,
  minimizeToTray: true,
  theme: 'dark',
  language: 'system',
  opacity: 0.98,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  showShortcutHints: true,
  listDensity: 'normal',
  copyOnSelect: true,
  recordImages: true,
  soundEnabled: false,
  ignoreSensitive: true,
  ignoredPatterns: [],
  hideAfterCopy: false,
  autoDeleteDays: 30,
  verificationCodeTtlMinutes: 10,
}

function normalizeSettings(settings: Partial<Settings>): Settings {
  const merged = { ...defaultSettings, ...settings }
  return {
    ...merged,
    language: merged.language === 'zh-CN' || merged.language === 'en-US' ? merged.language : 'system',
    ignoredPatterns: Array.isArray(merged.ignoredPatterns) ? merged.ignoredPatterns : [],
    opacity: Math.min(1, Math.max(0.7, merged.opacity)),
  }
}

function filterHistory(history: ClipboardItem[], activeTab: ActiveTab, searchQuery: string, filterType: string | null): ClipboardItem[] {
  let filtered = history
  if (activeTab === 'favorites') {
    filtered = filtered.filter(item => item.favorited)
  }
  if (searchQuery) filtered = filtered.filter(item => matchesClipboardQuery(item, searchQuery))
  if (filterType) filtered = filtered.filter(item => item.type === filterType)
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
  quickAddOpen: boolean
  activeTab: ActiveTab
  copiedId: string | null
  detailItemId: string | null
  filterType: string | null
  _copiedTimer: ReturnType<typeof setTimeout> | null

  setHistory: (history: ClipboardItem[]) => void
  setSearchQuery: (query: string) => void
  setSelectedId: (id: string | null) => void
  setSettings: (settings: Settings) => void
  setPrivacy: (privacy: PrivacyState) => void
  setShowSettings: (show: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setActiveTab: (tab: ActiveTab) => void
  setDetailItemId: (id: string | null) => void
  setFilterType: (type: string | null) => void
  addItem: (draft: ClipboardItemDraft) => Promise<{ itemId: string | null; created: boolean }>
  updateItemTags: (id: string, tags: string[]) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  clearAllHistory: () => Promise<void>
  importHistory: (payload: unknown, mode?: 'merge' | 'replace') => Promise<number>
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
  quickAddOpen: false,
  activeTab: 'history',
  copiedId: null,
  detailItemId: null,
  filterType: null,
  _copiedTimer: null,

  setHistory: (history) => {
    const { searchQuery, activeTab, filterType } = get()
    set({ history, filteredHistory: filterHistory(history, activeTab, searchQuery, filterType) })
  },

  setSearchQuery: (searchQuery) => {
    const { history, activeTab, filterType } = get()
    set({ searchQuery, filteredHistory: filterHistory(history, activeTab, searchQuery, filterType) })
  },

  setSelectedId: (selectedId) => set({ selectedId }),
  setSettings: (settings) => set({ settings: normalizeSettings(settings) }),
  setPrivacy: (privacy) => set({ privacy }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setDetailItemId: (detailItemId) => set({ detailItemId }),

  setActiveTab: (activeTab) => {
    const { history, searchQuery, filterType } = get()
    set({ activeTab, showSettings: activeTab === 'settings', filteredHistory: filterHistory(history, activeTab, searchQuery, filterType) })
  },

  setFilterType: (filterType) => {
    const { history, searchQuery, activeTab } = get()
    set({ filterType, filteredHistory: filterHistory(history, activeTab, searchQuery, filterType) })
  },

  addItem: async (draft) => {
    if (!window.electronAPI) return { itemId: null, created: false }
    const result = await window.electronAPI.createItem({ ...draft, tags: normalizeTags(draft.tags) })
    set({ activeTab: 'history', showSettings: false, searchQuery: '', filterType: null })
    get().setHistory(result.history)
    set({ quickAddOpen: false, detailItemId: result.itemId, selectedId: result.itemId })
    return { itemId: result.itemId, created: result.created }
  },

  updateItemTags: async (id, tags) => {
    const normalized = normalizeTags(tags)
    const previous = get().history
    get().setHistory(previous.map(item => item.id === id ? { ...item, tags: normalized } : item))
    try {
      if (!window.electronAPI) return
      const history = await window.electronAPI.updateItemTags(id, normalized)
      get().setHistory(history)
    } catch (err) {
      get().setHistory(previous)
      console.error('updateItemTags failed:', err)
    }
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

  clearAllHistory: async () => {
    try {
      if (window.electronAPI) {
        const newHistory = await window.electronAPI.clearAllHistory()
        get().setHistory(newHistory)
      }
    } catch (err) { console.error('clearAllHistory failed:', err) }
  },

  importHistory: async (payload, mode = 'merge') => {
    try {
      if (!window.electronAPI) return 0
      const result = await window.electronAPI.importHistory(payload, mode)
      get().setHistory(result.history)
      return result.imported
    } catch (err) {
      console.error('importHistory failed:', err)
      return 0
    }
  },

  copyItem: async (id) => {
    const { history, _copiedTimer, settings } = get()
    const item = history.find(h => h.id === id)
    if (!item || !window.electronAPI) return
    try {
      if (_copiedTimer) clearTimeout(_copiedTimer)
      const updatedHistory = await window.electronAPI.copyToClipboard(item)
      get().setHistory(updatedHistory)
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
