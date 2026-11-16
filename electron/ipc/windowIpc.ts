import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'

/** 窗口域 IPC：minimize/close/toggle-maximize/set-window-mode。 */
export function registerWindowIpc(binder: IpcBinder, s: AppServices): void {
  binder.handle('minimize-window', event => {
    s.runtime.assertTrustedRenderer(event)
    s.window.minimizeWindow()
  })
  binder.handle('close-window', event => {
    s.runtime.assertTrustedRenderer(event)
    s.window.closeWindow()
  })
  binder.handle('toggle-maximize', event => {
    s.runtime.assertTrustedRenderer(event)
    s.window.toggleMaximize()
  })
  binder.handle('set-window-mode', (event, requestedMode) => {
    s.runtime.assertTrustedRenderer(event)
    s.window.applyWindowMode(requestedMode === 'quick' ? 'quick' : 'library')
  })
}
