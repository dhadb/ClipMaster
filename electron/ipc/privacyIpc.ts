import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'

/** 隐私域 IPC：get-privacy-state / pause-monitoring / resume-monitoring。 */
export function registerPrivacyIpc(binder: IpcBinder, s: AppServices): void {
  binder.handle('get-privacy-state', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.privacy.getPrivacyState()
  })
  binder.handle('pause-monitoring', (event, requestedMode) => {
    s.runtime.assertTrustedRenderer(event)
    s.privacy.pauseMonitoring(requestedMode === 'current-application' ? 'application' : requestedMode)
    return s.privacy.getPrivacyState()
  })
  binder.handle('resume-monitoring', event => {
    s.runtime.assertTrustedRenderer(event)
    s.privacy.resumeMonitoring()
    return s.privacy.getPrivacyState()
  })
}
