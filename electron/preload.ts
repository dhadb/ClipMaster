import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { IpcChannel, IpcContract, IpcEventChannel, IpcEventContract, ImagePayloadSize, ImportMode, ViewMode, ClipboardItemDraft, PauseMonitoringRequest, Settings, PrivacyState, UpdateDownloadProgress } from '../shared/ipc-contract'
import type { ClipboardItem } from '../src/types/clipboard'
import type { StorageHealth } from '../src/types/storageHealth'

/** 类型化的 ipcRenderer.invoke：通道名与参数/返回值全部来自 shared 契约。 */
function invoke<K extends IpcChannel>(channel: K, ...args: IpcContract[K]['request']): Promise<IpcContract[K]['response']> {
  return ipcRenderer.invoke(channel, ...args)
}

/** 类型化的事件订阅：通道名与载荷来自 shared 契约，返回取消订阅函数。 */
function subscribe<K extends IpcEventChannel>(channel: K, callback: (...args: IpcEventContract[K]) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: IpcEventContract[K]) => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => { ipcRenderer.removeListener(channel, handler) }
}

const electronAPI = {
  getImageDataUrl: (imagePath?: string, size: ImagePayloadSize = 'thumb'): Promise<string | null> => invoke('get-image-data-url', imagePath, size),
  getImageInfo: (imagePath?: string) => invoke('get-image-info', imagePath),
  cleanupImageCache: () => invoke('cleanup-image-cache'),
  openExternalUrl: (url: string) => invoke('open-external-url', url),
  showFileInFolder: (filePath: string) => invoke('show-file-in-folder', filePath),
  getHistory: () => invoke('get-history'),
  getAppVersion: () => invoke('get-app-version'),
  getDataSecurityStatus: () => invoke('get-data-security-status'),
  // P0-1：落盘健康度（备份恢复 / 主文件隔离 / 保存裁剪 / 加密降级）。
  getStorageHealth: () => invoke('get-storage-health'),
  checkForUpdates: (force = false) => invoke('check-for-updates', force),
  downloadUpdate: () => invoke('download-update'),
  installUpdate: () => invoke('install-update'),
  copyToClipboard: (item: ClipboardItem | string, options?: { pasteAfterCopy?: boolean }) => invoke('copy-to-clipboard', item, options),
  createItem: (draft: ClipboardItemDraft) => invoke('create-item', draft),
  updateItemTags: (id: string, tags: string[]) => invoke('update-item-tags', id, tags),
  updateItem: (id: string, patch: { content?: string; tags?: string[]; workspace?: string }) => invoke('update-item', id, patch),
  deleteItem: (id: string) => invoke('delete-item', id),
  deleteItems: (ids: string[]) => invoke('delete-items', ids),
  restoreItems: (items: ClipboardItem[]) => invoke('restore-items', items),
  batchUpdateItems: (ids: string[], patch: { pinned?: boolean; favorited?: boolean; addTags?: string[] }) => invoke('batch-update-items', ids, patch),
  togglePin: (id: string) => invoke('toggle-pin', id),
  toggleFavorite: (id: string) => invoke('toggle-favorite', id),
  clearHistory: () => invoke('clear-history'),
  clearAllHistory: () => invoke('clear-all-history'),
  importHistory: (payload: unknown, mode: ImportMode = 'merge') => invoke('import-history', payload, mode),
  getSettings: () => invoke('get-settings'),
  updateSettings: (settings: Partial<Settings>) => invoke('update-settings', settings),
  getPrivacyState: () => invoke('get-privacy-state'),
  pauseMonitoring: (mode: PauseMonitoringRequest) => invoke('pause-monitoring', mode),
  resumeMonitoring: () => invoke('resume-monitoring'),
  minimizeWindow: () => invoke('minimize-window'),
  closeWindow: () => invoke('close-window'),
  toggleMaximize: () => invoke('toggle-maximize'),
  setWindowMode: (mode: ViewMode) => invoke('set-window-mode', mode),
  onHistoryUpdated: (callback: (history: ClipboardItem[]) => void) => subscribe('history-updated', history => callback(history)),
  onSettingsUpdated: (callback: (settings: Settings) => void) => subscribe('settings-updated', settings => callback(settings)),
  onPrivacyUpdated: (callback: (state: PrivacyState) => void) => subscribe('privacy-updated', state => callback(state)),
  // 落盘健康变化推送：主进程在 saveData 结束后发现裁剪/恢复/报错变化才发一条，
  // 渲染层无需重开窗口即可看到新的提示。
  onStorageHealthChanged: (callback: (health: StorageHealth) => void) => subscribe('storage-health-changed', health => callback(health)),
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => subscribe('update-download-progress', progress => callback(progress)),
  onFocusSearch: (callback: () => void) => subscribe('focus-search', () => callback()),
  onShowSettings: (callback: () => void) => subscribe('show-settings', () => callback()),
  onWindowMode: (callback: (mode: ViewMode) => void) => subscribe('window-mode', mode => callback(mode === 'quick' ? 'quick' : 'library')),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
