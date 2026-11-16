import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'

/** 设置域 IPC：get-settings / update-settings。 */
export function registerSettingsIpc(binder: IpcBinder, s: AppServices): void {
  binder.handle('get-settings', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.settings.getSettings()
  })
  binder.handle('update-settings', (event, newSettings) => {
    s.runtime.assertTrustedRenderer(event)
    return s.settings.updateSettings(newSettings)
  })
}
