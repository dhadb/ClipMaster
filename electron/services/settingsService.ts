import { app } from 'electron'
import { isThemeSetting } from '../../src/theme'
import { isAccentSetting } from '../../src/personalization'
import { normalizeSensitiveContentRules, defaultSensitiveContentRules } from '../../src/utils/privacy'
import { normalizeBlockedApplications } from '../../src/utils/applicationPrivacy'
import { compileIgnoredRules, normalizeIgnoredPatterns } from '../../src/utils/ignoredRules'
import type { SavedFilter } from '../../src/types/clipboard'
import type { Settings } from '../../shared/ipc-contract'
import type { AppServices } from './index'

export { defaultSensitiveContentRules }

export const defaultSettings: Settings = {
  maxHistory: 1000,
  hotkey: 'CommandOrControl+Shift+V',
  searchHotkey: 'CommandOrControl+Shift+F',
  clearHotkey: 'CommandOrControl+Shift+Delete',
  autoStart: true,
  minimizeToTray: true,
  theme: 'graphite',
  accentColor: 'theme',
  language: 'system',
  opacity: 0.95,
  fontSize: 14,
  windowWidth: 420,
  windowHeight: 600,
  showPreview: true,
  listDensity: 'normal',
  copyOnSelect: true,
  recordImages: true,
  soundEnabled: false,
  ignoreSensitive: true,
  sensitiveRules: { ...defaultSensitiveContentRules },
  blockedApplications: [],
  ignoredPatterns: [],
  hideAfterCopy: false,
  quickPaste: true,
  recentSearches: [],
  savedFilters: [],
  autoDeleteDays: 30,
  verificationCodeTtlMinutes: 10,
  autoCheckUpdates: true,
}

export function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, num))
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
}

export function sanitizeSavedFilters(input: unknown): SavedFilter[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const filters: SavedFilter[] = []
  for (const candidate of input) {
    const value = asRecord(candidate)
    if (!value || typeof value.id !== 'string' || typeof value.query !== 'string') continue
    const id = value.id.trim().slice(0, 80)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const query = value.query.trim().slice(0, 160)
    const label = (typeof value.label === 'string' ? value.label : query).trim().slice(0, 32) || 'Filter'
    filters.push({
      id,
      label,
      query,
      filterType: typeof value.filterType === 'string' ? value.filterType.slice(0, 32) : null,
      timeFilter: value.timeFilter === 'today' || value.timeFilter === 'week' ? value.timeFilter : 'all',
      sortMode: value.sortMode === 'oldest' || value.sortMode === 'most-used' ? value.sortMode : 'newest',
    })
    if (filters.length === 24) break
  }
  return filters
}

export function sanitizeRecentSearches(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const searches: string[] = []
  for (const candidate of input) {
    if (typeof candidate !== 'string') continue
    const value = candidate.trim().replace(/\s+/g, ' ').slice(0, 160)
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    searches.push(value)
    if (searches.length === 5) break
  }
  return searches
}

export function sanitizeSettings(input: Partial<Settings> | undefined): Settings {
  const raw = { ...defaultSettings, ...(input || {}) }
  return {
    maxHistory: Math.round(clamp(raw.maxHistory, 50, 5000, defaultSettings.maxHistory)),
    hotkey: typeof raw.hotkey === 'string' && raw.hotkey.trim() ? raw.hotkey.trim() : defaultSettings.hotkey,
    searchHotkey: typeof raw.searchHotkey === 'string' && raw.searchHotkey.trim() ? raw.searchHotkey.trim() : defaultSettings.searchHotkey,
    clearHotkey: typeof raw.clearHotkey === 'string' && raw.clearHotkey.trim() ? raw.clearHotkey.trim() : defaultSettings.clearHotkey,
    autoStart: Boolean(raw.autoStart),
    minimizeToTray: Boolean(raw.minimizeToTray),
    theme: isThemeSetting(raw.theme) ? raw.theme : 'graphite',
    accentColor: isAccentSetting(raw.accentColor) ? raw.accentColor : 'theme',
    language: raw.language === 'zh-CN' || raw.language === 'en-US' ? raw.language : 'system',
    opacity: clamp(raw.opacity, 0.7, 1, defaultSettings.opacity),
    fontSize: Math.round(clamp(raw.fontSize, 12, 18, defaultSettings.fontSize)),
    windowWidth: Math.round(clamp(raw.windowWidth, 350, 600, defaultSettings.windowWidth)),
    windowHeight: Math.round(clamp(raw.windowHeight, 400, 800, defaultSettings.windowHeight)),
    showPreview: Boolean(raw.showPreview),
    listDensity: raw.listDensity === 'compact' || raw.listDensity === 'comfortable' ? raw.listDensity : 'normal',
    copyOnSelect: Boolean(raw.copyOnSelect),
    recordImages: raw.recordImages !== false,
    soundEnabled: Boolean(raw.soundEnabled),
    ignoreSensitive: raw.ignoreSensitive !== false,
    sensitiveRules: normalizeSensitiveContentRules(raw.sensitiveRules),
    blockedApplications: normalizeBlockedApplications(raw.blockedApplications),
    ignoredPatterns: normalizeIgnoredPatterns(raw.ignoredPatterns),
    hideAfterCopy: Boolean(raw.hideAfterCopy),
    quickPaste: raw.quickPaste !== false,
    recentSearches: sanitizeRecentSearches(raw.recentSearches),
    savedFilters: sanitizeSavedFilters(raw.savedFilters),
    autoDeleteDays: Math.round(clamp(raw.autoDeleteDays, 0, 365, defaultSettings.autoDeleteDays)),
    verificationCodeTtlMinutes: Math.round(clamp(raw.verificationCodeTtlMinutes, 0, 1440, defaultSettings.verificationCodeTtlMinutes)),
    autoCheckUpdates: raw.autoCheckUpdates !== false,
  }
}

export interface SettingsService {
  getSettings(): Settings
  /** 应用 settings 变更（含热键/自启动/托盘/保留策略联动），返回最终生效值。 */
  updateSettings(nextSettings: Partial<Settings>): Settings
  applyAutoStart(): void
}

export function createSettingsService(services: AppServices): SettingsService {
  const rt = services.runtime

  function applyAutoStart() {
    try {
      const executablePath = services.appInfo.getExecutablePath()
      app.setLoginItemSettings({
        openAtLogin: rt.settings.autoStart,
        path: executablePath,
      })
    } catch (err) {
      console.error('Failed to update auto start:', err)
    }
  }

  return {
    getSettings: () => rt.settings,
    applyAutoStart,
    updateSettings(newSettings: Partial<Settings>) {
      const oldSettings = rt.settings
      let nextSettings = sanitizeSettings({ ...rt.settings, ...newSettings })

      const hotkeysChanged = hotkeyDefinitions.some(({ key }) => oldSettings[key] !== nextSettings[key])
      if (hotkeysChanged && !services.hotkeys.register(nextSettings)) {
        nextSettings = sanitizeSettings({ ...nextSettings, hotkey: oldSettings.hotkey, searchHotkey: oldSettings.searchHotkey, clearHotkey: oldSettings.clearHotkey })
        services.hotkeys.register(nextSettings)
      }

      rt.settings = nextSettings
      rt.ignoredRules = compileIgnoredRules(nextSettings.ignoredPatterns)
      services.privacy.rebuildMatcher()

      if (oldSettings.autoStart !== rt.settings.autoStart) applyAutoStart()
      if (oldSettings.language !== rt.settings.language) services.tray.rebuildMenu()
      if (oldSettings.maxHistory !== rt.settings.maxHistory || oldSettings.autoDeleteDays !== rt.settings.autoDeleteDays || oldSettings.verificationCodeTtlMinutes !== rt.settings.verificationCodeTtlMinutes) {
        services.history.applyRetentionRules()
        rt.sendToRenderer('history-updated', rt.history)
      }

      rt.sendToRenderer('settings-updated', rt.settings)
      services.storage.scheduleSave()

      if (oldSettings.windowWidth !== rt.settings.windowWidth || oldSettings.windowHeight !== rt.settings.windowHeight) {
        rt.mainWindow?.setSize(rt.settings.windowWidth, rt.settings.windowHeight)
      }
      return rt.settings
    },
  }
}

// 热键定义被 settings 与 hotkey 两个域共用，放在这里避免循环依赖。
export const hotkeyDefinitions: Array<{ action: 'toggle' | 'search' | 'clear'; key: 'hotkey' | 'searchHotkey' | 'clearHotkey' }> = [
  { action: 'toggle', key: 'hotkey' },
  { action: 'search', key: 'searchHotkey' },
  { action: 'clear', key: 'clearHotkey' },
]
