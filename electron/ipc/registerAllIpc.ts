import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'
import { registerImageIpc } from './imageIpc'
import { registerSystemIpc } from './systemIpc'
import { registerHistoryIpc } from './historyIpc'
import { registerSettingsIpc } from './settingsIpc'
import { registerPrivacyIpc } from './privacyIpc'
import { registerWindowIpc } from './windowIpc'

/**
 * 按域注册 IPC handler（main 进程组合根调用；契约测试用记录器调用）。
 * 注意：check-for-updates / download-update / install-update 三个更新通道
 * 在 electron/main.ts 直接用 ipcMain.handle 注册——releaseSafetyContract.test
 * 对 main.ts 源码做字面契约断言（更新链 fail-closed），该测试禁改。
 */
export function registerAllIpcHandlers(binder: IpcBinder, services: AppServices): void {
  registerImageIpc(binder, services)
  registerSystemIpc(binder, services)
  registerHistoryIpc(binder, services)
  registerSettingsIpc(binder, services)
  registerPrivacyIpc(binder, services)
  registerWindowIpc(binder, services)
}
