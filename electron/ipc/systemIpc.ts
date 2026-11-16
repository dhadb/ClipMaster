import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'

/** 系统域 IPC：外链/文件夹打开、版本、数据安全状态、落盘健康。 */
export function registerSystemIpc(binder: IpcBinder, s: AppServices): void {
  binder.handle('open-external-url', async (event, url) => {
    s.runtime.assertTrustedRenderer(event)
    if (!s.image.canOpenExternalUrl(url)) return false
    await s.shell.openExternal(url.trim())
    return true
  })
  binder.handle('show-file-in-folder', async (event, filePath) => {
    s.runtime.assertTrustedRenderer(event)
    if (!s.image.canShowFilePath(filePath)) return false
    s.shell.showItemInFolder(filePath.trim())
    return true
  })
  binder.handle('get-app-version', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.appInfo.getVersion()
  })
  binder.handle('get-data-security-status', event => {
    s.runtime.assertTrustedRenderer(event)
    const available = s.storage.isDataEncryptionAvailable()
    return {
      available,
      active: available && s.runtime.storageEncryptionState !== 'plain',
      migrating: available && s.runtime.storageEncryptionState === 'plain',
    }
  })
  binder.handle('get-storage-health', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.storage.getStorageHealthSnapshot()
  })
}
