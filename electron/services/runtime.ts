import type { BrowserWindow, Tray, IpcMainInvokeEvent } from 'electron'
import type { CompiledIgnoredRule } from '../../src/utils/ignoredRules'
import type { ClipboardItem } from '../../src/types/clipboard'
import type { StorageHealth } from '../../src/types/storageHealth'
import type { Settings, PauseMode, ViewMode, UpdateInfo } from '../../shared/ipc-contract'
import type { IpcEventChannel } from '../../shared/ipc-contract'
import { nodeFileSystem, type Clock, type FileSystemPort, type ForegroundTarget } from './ports'

export type { ForegroundTarget }
export type HotkeyAction = 'toggle' | 'search' | 'clear'

/** 落盘健康状态（不含 encryption，见 src/types/storageHealth.ts）。 */
export type StorageHealthState = Omit<StorageHealth, 'encryption'>

/** 渲染端窗口尺寸记忆（最大化还原用）。 */
export interface SavedBounds {
  x: number
  y: number
  width: number
  height: number
}

/** initStorage() 的产物：所有落盘路径在此集中声明。 */
export interface StoragePaths {
  dataPath: string
  backupPath: string
  imagesDir: string
}

/**
 * 应用运行时：此前散落在 main.ts 顶层的约 20 个共享可变全局全部收敛到这里。
 * 服务工厂接收 runtime（及服务包）完成互调；组合根负责创建与装配。
 */
export interface AppRuntime {
  ports: {
    clock: Clock
    fs: FileSystemPort
  }
  isDev: boolean
  isPackaged: boolean
  paths: StoragePaths

  // === 窗口 / 托盘 ===
  mainWindow: BrowserWindow | null
  tray: Tray | null
  isMaximized: boolean
  savedBounds: SavedBounds | null
  showWindowPromise: Promise<void> | null

  // === 数据 ===
  history: ClipboardItem[]
  settings: Settings
  ignoredRules: CompiledIgnoredRule[]
  guardedIgnoreMatcher: (text: string) => boolean
  storageEncryptionState: 'encrypted' | 'plain' | 'unknown'
  storageHealth: StorageHealthState
  saveTimer: ReturnType<typeof setTimeout> | null

  // === 暂停 / 隐私 ===
  pauseMode: PauseMode
  pauseUntil: number
  pausedWorkspace: string
  pausedApplicationKey: string
  protectedToday: number
  protectedDate: string

  // === 剪贴板轮询 ===
  clipboardWatcher: ReturnType<typeof setInterval> | null
  clipboardWatcherRestartTimer: ReturnType<typeof setTimeout> | null
  clipboardWatcherErrorCount: number
  lastClipboardContent: string
  lastClipboardFormatHash: string
  lastClipboardImageHash: string
  lastImageCheckAt: number

  // === 图片删除调度 ===
  pendingImageDeletes: Map<string, ReturnType<typeof setTimeout>>

  // === 前台跟踪 ===
  foregroundTracker: ReturnType<typeof setTimeout> | null
  foregroundTrackerRequestInFlight: boolean
  foregroundSampleSequence: number
  lastAppliedForegroundSample: number
  currentForegroundTarget: ForegroundTarget | null
  lastExternalForegroundTarget: ForegroundTarget | null
  quickPasteTarget: ForegroundTarget | null

  // === 热键 ===
  currentHotkeys: Map<HotkeyAction, string>

  // === 生命周期 ===
  isQuitting: boolean

  // === 行为辅助 ===
  now(): number
  sendToRenderer(channel: IpcEventChannel, ...args: unknown[]): void
  assertTrustedRenderer(event: IpcMainInvokeEvent): void
}

export interface CreateRuntimeOptions {
  clock?: Clock
  fs?: FileSystemPort
  isDev: boolean
  isPackaged?: boolean
  paths: StoragePaths
  settings: Settings
}

export function createAppRuntime(options: CreateRuntimeOptions): AppRuntime {
  const { isDev, isPackaged, paths, settings } = options
  const clock = options.clock ?? { now: () => Date.now() }
  // fs 端口必须回退到真实 Node 实现：{} 会让图片等依赖文件系统的服务在运行时全部崩溃。
  const fs = options.fs ?? nodeFileSystem

  const runtime: AppRuntime = {
    ports: { clock, fs },
    isDev,
    isPackaged: isPackaged ?? !isDev,
    paths,

    mainWindow: null,
    tray: null,
    isMaximized: false,
    savedBounds: null,
    showWindowPromise: null,

    history: [],
    settings: { ...settings },
    ignoredRules: [],
    guardedIgnoreMatcher: () => false,
    storageEncryptionState: 'unknown',
    storageHealth: {
      recoveredFromBackup: false,
      loadFailed: false,
      corruptFilePath: null,
      trimmedOnSave: 0,
      lastError: null,
    },
    saveTimer: null,

    pauseMode: null,
    pauseUntil: 0,
    pausedWorkspace: '',
    pausedApplicationKey: '',
    protectedToday: 0,
    protectedDate: '',

    clipboardWatcher: null,
    clipboardWatcherRestartTimer: null,
    clipboardWatcherErrorCount: 0,
    lastClipboardContent: '',
    lastClipboardFormatHash: '',
    lastClipboardImageHash: '',
    lastImageCheckAt: 0,

    pendingImageDeletes: new Map(),

    foregroundTracker: null,
    foregroundTrackerRequestInFlight: false,
    foregroundSampleSequence: 0,
    lastAppliedForegroundSample: 0,
    currentForegroundTarget: null,
    lastExternalForegroundTarget: null,
    quickPasteTarget: null,

    currentHotkeys: new Map(),

    isQuitting: false,

    now: () => clock.now(),
    sendToRenderer: (channel, ...args) => {
      const win = runtime.mainWindow
      if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
      try {
        win.webContents.send(channel, ...args)
      } catch (err) {
        console.error(`Failed to send ${String(channel)} to renderer:`, err)
      }
    },
    assertTrustedRenderer: event => {
      const url = event.senderFrame?.url || ''
      const trusted = isDev
        ? url === 'http://localhost:5173' || url.startsWith('http://localhost:5173/')
        : url.startsWith('file://')
      if (!trusted) throw new Error('Untrusted renderer')
    },
  }
  return runtime
}

/** 供 main.ts 使用的 ipcMain 适配类型（避免 ipc 层直接依赖 electron 运行时）。 */
export interface IpcMainLike {
  handle(channel: string, handler: (...args: never[]) => unknown): void
}

/** 窗口模式尺寸表（applyWindowMode 用）。 */
export const WINDOW_MODE_SIZES: Record<ViewMode, { target: { width: number; height: number }; minimum: { width: number; height: number } }> = {
  quick: { target: { width: 520, height: 680 }, minimum: { width: 420, height: 520 } },
  library: { target: { width: 980, height: 720 }, minimum: { width: 760, height: 560 } },
}

/**
 * 存储域接口。实现保留在 electron/main.ts：src/utils 的 storageHealthContract.test
 * 对 main.ts 源码做字面契约断言（trimmedOnSave 语义等，禁改该测试），故此域
 * 无法物理外移；接口仍在此声明以保持服务包的类型完整。
 */
export interface StorageService {
  isDataEncryptionAvailable(): boolean
  getStorageHealthSnapshot(): StorageHealth
  loadData(): void
  saveData(): void
  scheduleSave(): void
  flushPendingSave(): void
  cleanupStaleTempFiles(): void
}

/**
 * 更新域接口。实现保留在 electron/main.ts：releaseSafetyContract.test 对 main.ts
 * 源码做字面契约断言（更新链 fail-closed，禁改该测试），故此域无法物理外移。
 */
export interface UpdateService {
  checkForUpdates(force?: boolean): Promise<UpdateInfo>
  downloadUpdate(): Promise<{ version: string }>
  installUpdate(): Promise<{ version: string }>
  cleanupStaleInstallers(): void
}
