/**
 * 服务装配（组合根使用）。所有服务在此集中创建：
 * - 各 service 工厂只依赖 AppServices 包 + 端口，互相调用走包内 late-binding，
 *   因此这里按任意顺序创建都不会产生模块级循环依赖。
 * - electron / node 能力全部经 ports 注入，测试可整体替换。
 */
import {
  electronAppInfo,
  electronClipboard,
  electronHttpFetcher,
  electronShell,
  nodeFileSystem,
  type AppInfoPort,
  type ClipboardPort,
  type Clock,
  type FileSystemPort,
  type ForegroundDetector,
  type HttpFetcher,
  type ShellPort,
} from './ports'
import { createAppRuntime, type AppRuntime, type StoragePaths, type StorageService, type UpdateService } from './runtime'
import { createSettingsService, defaultSettings, type SettingsService } from './settingsService'
import { createImageService, type ImageService } from './imageService'
import { createHistoryService, normalizeWorkspace, type HistoryService } from './historyService'
import { createPrivacyService, type PrivacyService } from './privacyService'
import { createForegroundService, createPowerShellForegroundDetector, type ForegroundService } from './foregroundService'
import { createWindowService, type WindowService } from './windowService'
import { createTrayService, type TrayService } from './trayService'
import { createHotkeyService, type HotkeyService } from './hotkeyService'
import { createQuickPasteService, type QuickPasteService } from './quickPasteService'
import { createClipboardMonitorService, type ClipboardMonitorService } from './clipboardMonitorService'

export interface AppServices {
  runtime: AppRuntime
  // ports（默认实现可在测试中替换）
  appInfo: AppInfoPort
  clipboard: ClipboardPort
  http: HttpFetcher
  shell: ShellPort
  detector: ForegroundDetector
  // domains
  settings: SettingsService
  image: ImageService
  history: HistoryService
  storage: StorageService
  privacy: PrivacyService
  foreground: ForegroundService
  monitor: ClipboardMonitorService
  window: WindowService
  tray: TrayService
  hotkeys: HotkeyService
  quickPaste: QuickPasteService
  /** 更新域实现在 main.ts（源码契约钉住），不经服务包暴露。 */
  updates?: UpdateService
}

export interface CreateServicesOptions {
  isDev: boolean
  isPackaged: boolean
  paths: StoragePaths
  clock?: Clock
  fs?: FileSystemPort
  clipboard?: ClipboardPort
  http?: HttpFetcher
  shell?: ShellPort
  detector?: ForegroundDetector
  appInfo?: AppInfoPort
}

export function createAppServices(options: CreateServicesOptions): AppServices {
  const services = {} as AppServices

  services.runtime = createAppRuntime({
    clock: options.clock,
    // fs 缺省必须回落到真实 Node 实现，否则图片等文件系统服务运行时全崩。
    fs: options.fs ?? nodeFileSystem,
    isDev: options.isDev,
    isPackaged: options.isPackaged,
    paths: options.paths,
    settings: defaultSettings,
  })
  services.appInfo = options.appInfo ?? electronAppInfo
  services.clipboard = options.clipboard ?? electronClipboard
  services.http = options.http ?? electronHttpFetcher
  services.shell = options.shell ?? electronShell
  services.detector = options.detector ?? createPowerShellForegroundDetector(services.runtime.now, normalizeWorkspace)

  services.settings = createSettingsService(services)
  services.image = createImageService(services)
  services.history = createHistoryService(services)
  services.privacy = createPrivacyService(services)
  services.foreground = createForegroundService(services)
  // storage 域的实现保留在 electron/main.ts（storageHealthContract.test 把
  // trimmedOnSave 等字面契约钉在 main.ts，禁改该测试），由组合根赋值到服务包。
  services.window = createWindowService(services)
  services.tray = createTrayService(services)
  services.hotkeys = createHotkeyService(services)
  services.quickPaste = createQuickPasteService(services)
  services.monitor = createClipboardMonitorService(services)

  return services
}

export { defaultSettings }
export type { StorageService, UpdateService }
