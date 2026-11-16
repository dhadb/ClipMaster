/**
 * ClipMaster IPC 契约（单一事实来源）。
 *
 * main 进程的 ipcMain.handle、preload 的 ipcRenderer.invoke、渲染端的
 * ElectronAPI 类型全部以本文件为准：通道名、请求参数元组、响应类型、
 * 主进程推送事件及其载荷都在这里定义。改通道/载荷必须先改这里，
 * typecheck 会迫使三端同步。
 *
 * 本文件必须保持“零运行时副作用、零 electron 依赖”：只导出类型与常量，
 * 因此可以被 main / preload / 渲染层 / vitest 测试安全地共同导入。
 */
import type { ClipboardItem, SavedFilter } from '../src/types/clipboard'
import type { StorageHealth } from '../src/types/storageHealth'
import type { ThemeSetting } from '../src/theme'
import type { AccentSetting } from '../src/personalization'
import type { LanguageSetting } from '../src/i18n'
import type { SensitiveContentRules } from '../src/utils/privacy'

// === 共享数据类型（此前在 store/preload/main 三处重复定义） ===

export type ViewMode = 'quick' | 'library'
export type ImportMode = 'merge' | 'replace'
export type ImagePayloadSize = 'thumb' | 'detail'
export type PauseMode = 'timed' | 'until-resume' | 'application' | null

export interface SavedFilterShape {
  id: string
  label: string
  query: string
  filterType: string | null
  timeFilter: 'all' | 'today' | 'week'
  sortMode: 'newest' | 'oldest' | 'most-used'
}

export interface Settings {
  maxHistory: number
  hotkey: string
  searchHotkey: string
  clearHotkey: string
  autoStart: boolean
  minimizeToTray: boolean
  theme: ThemeSetting
  accentColor: AccentSetting
  language: LanguageSetting
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
  sensitiveRules: SensitiveContentRules
  blockedApplications: string[]
  ignoredPatterns: string[]
  hideAfterCopy: boolean
  quickPaste: boolean
  recentSearches: string[]
  savedFilters: SavedFilter[]
  autoDeleteDays: number
  verificationCodeTtlMinutes: number
  autoCheckUpdates: boolean
}

export interface PrivacyState {
  paused: boolean
  pauseUntil: number
  pauseMode: PauseMode
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

export interface ImageInfoPayload {
  bytes: number
  width: number
  height: number
}

export interface ImageCacheCleanupResult {
  deleted: number
  bytes: number
}

export interface ImportHistoryResult {
  history: ClipboardItem[]
  imported: number
}

export interface CreateItemResult {
  history: ClipboardItem[]
  itemId: string | null
  created: boolean
}

export interface VersionPayload {
  version: string
}

export interface UpdateItemPatch {
  content?: string
  tags?: string[]
  workspace?: string
}

export interface BatchUpdateItemPatch {
  pinned?: boolean
  favorited?: boolean
  addTags?: string[]
}

export type PauseMonitoringRequest = number | 'until-resume' | 'current-application'

// === invoke 通道契约：channel -> { request: 参数元组; response: 返回值 } ===

export interface IpcContract {
  'get-image-data-url': { request: [imagePath?: string, size?: ImagePayloadSize]; response: string | null }
  'get-image-info': { request: [imagePath?: string]; response: ImageInfoPayload | null }
  'cleanup-image-cache': { request: []; response: ImageCacheCleanupResult }
  'open-external-url': { request: [url: string]; response: boolean }
  'show-file-in-folder': { request: [filePath: string]; response: boolean }
  'get-history': { request: []; response: ClipboardItem[] }
  'get-app-version': { request: []; response: string }
  'get-data-security-status': { request: []; response: DataSecurityStatus }
  'get-storage-health': { request: []; response: StorageHealth }
  'check-for-updates': { request: [force?: boolean]; response: UpdateInfo }
  'download-update': { request: []; response: VersionPayload }
  'install-update': { request: []; response: VersionPayload }
  'copy-to-clipboard': { request: [item: ClipboardItem | string, options?: { pasteAfterCopy?: boolean }]; response: ClipboardItem[] }
  'create-item': { request: [draft: ClipboardItemDraft]; response: CreateItemResult }
  'update-item-tags': { request: [id: string, tags: string[]]; response: ClipboardItem[] }
  'update-item': { request: [id: string, patch: UpdateItemPatch]; response: ClipboardItem[] }
  'delete-item': { request: [id: string]; response: ClipboardItem[] }
  'delete-items': { request: [ids: string[]]; response: DeleteItemsResult }
  'restore-items': { request: [items: ClipboardItem[]]; response: ClipboardItem[] }
  'batch-update-items': { request: [ids: string[], patch: BatchUpdateItemPatch]; response: ClipboardItem[] }
  'toggle-pin': { request: [id: string]; response: ClipboardItem[] }
  'toggle-favorite': { request: [id: string]; response: ClipboardItem[] }
  'clear-history': { request: []; response: ClipboardItem[] }
  'clear-all-history': { request: []; response: ClipboardItem[] }
  'import-history': { request: [payload: unknown, mode?: ImportMode]; response: ImportHistoryResult }
  'get-settings': { request: []; response: Settings }
  'update-settings': { request: [settings: Partial<Settings>]; response: Settings }
  'get-privacy-state': { request: []; response: PrivacyState }
  'pause-monitoring': { request: [mode: PauseMonitoringRequest]; response: PrivacyState }
  'resume-monitoring': { request: []; response: PrivacyState }
  'minimize-window': { request: []; response: void }
  'close-window': { request: []; response: void }
  'toggle-maximize': { request: []; response: void }
  'set-window-mode': { request: [mode: ViewMode]; response: void }
}

export type IpcChannel = keyof IpcContract

/**
 * 通道清单。用 Record<IpcChannel, true> 在编译期强制“不缺不多”——
 * 新增/删除契约通道时漏改这里会直接 typecheck 失败。
 */
const ipcChannelPresence: Record<IpcChannel, true> = {
  'get-image-data-url': true,
  'get-image-info': true,
  'cleanup-image-cache': true,
  'open-external-url': true,
  'show-file-in-folder': true,
  'get-history': true,
  'get-app-version': true,
  'get-data-security-status': true,
  'get-storage-health': true,
  'check-for-updates': true,
  'download-update': true,
  'install-update': true,
  'copy-to-clipboard': true,
  'create-item': true,
  'update-item-tags': true,
  'update-item': true,
  'delete-item': true,
  'delete-items': true,
  'restore-items': true,
  'batch-update-items': true,
  'toggle-pin': true,
  'toggle-favorite': true,
  'clear-history': true,
  'clear-all-history': true,
  'import-history': true,
  'get-settings': true,
  'update-settings': true,
  'get-privacy-state': true,
  'pause-monitoring': true,
  'resume-monitoring': true,
  'minimize-window': true,
  'close-window': true,
  'toggle-maximize': true,
  'set-window-mode': true,
}

/** 全部 invoke 通道名（契约测试遍历它断言 main 侧已全部注册）。 */
export const IPC_CHANNELS = Object.keys(ipcChannelPresence) as IpcChannel[]

// === 主进程 → 渲染端推送事件契约：channel -> 载荷元组 ===

export interface IpcEventContract {
  'history-updated': [history: ClipboardItem[]]
  'settings-updated': [settings: Settings]
  'privacy-updated': [state: PrivacyState]
  'storage-health-changed': [health: StorageHealth]
  'update-download-progress': [progress: UpdateDownloadProgress]
  'focus-search': []
  'show-settings': []
  'window-mode': [mode: ViewMode]
}

export type IpcEventChannel = keyof IpcEventContract

const ipcEventChannelPresence: Record<IpcEventChannel, true> = {
  'history-updated': true,
  'settings-updated': true,
  'privacy-updated': true,
  'storage-health-changed': true,
  'update-download-progress': true,
  'focus-search': true,
  'show-settings': true,
  'window-mode': true,
}

/** 全部推送事件通道名。 */
export const IPC_EVENT_CHANNELS = Object.keys(ipcEventChannelPresence) as IpcEventChannel[]
