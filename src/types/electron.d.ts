import type { ClipboardItem } from './clipboard'
import type { StorageHealth } from './storageHealth'
// P1-A：类型统一来自 shared IPC 契约（单一事实来源）。
import type {
  BatchUpdateItemPatch,
  ClipboardItemDraft,
  DataSecurityStatus,
  ImageInfoPayload,
  ImageCacheCleanupResult,
  ImagePayloadSize,
  ImportHistoryResult,
  ImportMode,
  PauseMonitoringRequest,
  PrivacyState,
  Settings,
  UpdateDownloadProgress,
  UpdateInfo,
  ViewMode,
} from '../../shared/ipc-contract'

export type {
  BatchUpdateItemPatch,
  ClipboardItemDraft,
  DataSecurityStatus,
  ImageInfoPayload,
  ImageCacheCleanupResult,
  ImagePayloadSize,
  ImportHistoryResult,
  ImportMode,
  PauseMonitoringRequest,
  PrivacyState,
  Settings,
  UpdateDownloadProgress,
  UpdateInfo,
  ViewMode,
}

export interface ElectronAPI {
  getImageDataUrl: (imagePath?: string, size?: ImagePayloadSize) => Promise<string | null>
  openExternalUrl: (url: string) => Promise<boolean>
  showFileInFolder: (filePath: string) => Promise<boolean>
  getHistory: () => Promise<ClipboardItem[]>
  getAppVersion: () => Promise<string>
  getDataSecurityStatus: () => Promise<DataSecurityStatus>
  /** 落盘健康快照（IPC: get-storage-health）。旧版 preload 没有该方法，故为可选。 */
  getStorageHealth?: () => Promise<StorageHealth>
  checkForUpdates: (force?: boolean) => Promise<UpdateInfo>
  downloadUpdate: () => Promise<{ version: string }>
  installUpdate: () => Promise<{ version: string }>
  copyToClipboard: (item: ClipboardItem | string, options?: { pasteAfterCopy?: boolean }) => Promise<ClipboardItem[]>
  createItem: (draft: ClipboardItemDraft) => Promise<{ history: ClipboardItem[]; itemId: string | null; created: boolean }>
  updateItemTags: (id: string, tags: string[]) => Promise<ClipboardItem[]>
  updateItem: (id: string, patch: { content?: string; tags?: string[]; workspace?: string }) => Promise<ClipboardItem[]>
  deleteItem: (id: string) => Promise<ClipboardItem[]>
  deleteItems: (ids: string[]) => Promise<{ history: ClipboardItem[]; deleted: ClipboardItem[] }>
  restoreItems: (items: ClipboardItem[]) => Promise<ClipboardItem[]>
  batchUpdateItems: (ids: string[], patch: BatchUpdateItemPatch) => Promise<ClipboardItem[]>
  togglePin: (id: string) => Promise<ClipboardItem[]>
  toggleFavorite: (id: string) => Promise<ClipboardItem[]>
  clearHistory: () => Promise<ClipboardItem[]>
  getSettings: () => Promise<Settings>
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>
  getPrivacyState: () => Promise<PrivacyState>
  pauseMonitoring: (mode: PauseMonitoringRequest) => Promise<PrivacyState>
  resumeMonitoring: () => Promise<PrivacyState>
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  toggleMaximize: () => Promise<void>
  setWindowMode: (mode: ViewMode) => Promise<void>
  getImageInfo: (imagePath?: string) => Promise<ImageInfoPayload | null>
  cleanupImageCache: () => Promise<ImageCacheCleanupResult>
  clearAllHistory: () => Promise<ClipboardItem[]>
  importHistory: (payload: unknown, mode?: ImportMode) => Promise<ImportHistoryResult>
  onHistoryUpdated: (callback: (history: ClipboardItem[]) => void) => () => void
  onSettingsUpdated: (callback: (settings: Settings) => void) => () => void
  onPrivacyUpdated: (callback: (state: PrivacyState) => void) => () => void
  /** 落盘健康快照变化推送（取消订阅即返回的函数）。旧版 preload 没有该方法，故为可选。 */
  onStorageHealthChanged?: (callback: (health: StorageHealth) => void) => () => void
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void
  onFocusSearch: (callback: () => void) => () => void
  onShowSettings: (callback: () => void) => () => void
  onWindowMode: (callback: (mode: ViewMode) => void) => () => void
}
