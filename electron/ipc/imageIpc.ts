import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'

/** 图片域 IPC：get-image-data-url / get-image-info / cleanup-image-cache。 */
export function registerImageIpc(binder: IpcBinder, s: AppServices): void {
  binder.handle('get-image-data-url', (event, imagePath, size) => {
    s.runtime.assertTrustedRenderer(event)
    return s.image.getSafeImageDataUrl(imagePath, size === 'detail' ? 'detail' : 'thumb')
  })
  binder.handle('get-image-info', (event, imagePath) => {
    s.runtime.assertTrustedRenderer(event)
    return s.image.getImageInfo(imagePath)
  })
  binder.handle('cleanup-image-cache', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.image.cleanupImageCache()
  })
}
