import type { IpcBinder } from './registry'
import type { AppServices } from '../services/index'

/** 历史域 IPC：查询/复制/增删改/导入导出等。 */
export function registerHistoryIpc(binder: IpcBinder, s: AppServices): void {
  binder.handle('get-history', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.runtime.history
  })
  binder.handle('copy-to-clipboard', (event, itemOrContent, options) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.copyToClipboard(itemOrContent, options)
  })
  binder.handle('create-item', (event, draft) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.createItem(draft)
  })
  binder.handle('update-item-tags', (event, id, tags) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.updateItemTags(id, tags)
  })
  binder.handle('update-item', (event, id, patch) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.updateItem(id, patch)
  })
  binder.handle('delete-item', (event, id) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.deleteItem(id)
  })
  binder.handle('delete-items', (event, ids) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.deleteItems(ids)
  })
  binder.handle('restore-items', (event, items) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.restoreItems(items)
  })
  binder.handle('batch-update-items', (event, ids, patch) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.batchUpdateItems(ids, patch)
  })
  binder.handle('toggle-pin', (event, id) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.togglePin(id)
  })
  binder.handle('toggle-favorite', (event, id) => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.toggleFavorite(id)
  })
  binder.handle('clear-history', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.clearHistory()
  })
  binder.handle('clear-all-history', event => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.clearAllHistory()
  })
  binder.handle('import-history', (event, payload, mode = 'merge') => {
    s.runtime.assertTrustedRenderer(event)
    return s.history.importHistory(payload, mode)
  })
}
