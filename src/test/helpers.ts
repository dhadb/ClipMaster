// 公共测试工具：store 状态布置、electronAPI mock 访问、最小 ClipboardItem 构造。
// 仅测试代码使用，不参与应用构建。
import type { Mock } from 'vitest'
import { useClipboardStore, type ClipboardItem } from '../store/clipboardStore'

// zustand v5 的 setState 重载收窄，Parameters 推导不再含 Partial 形态；
// 显式声明补丁类型，保持 resetStore 支持部分状态覆盖与函数式更新的旧用法。
type ClipboardStoreState = ReturnType<typeof useClipboardStore.getState>
type StorePatch = Partial<ClipboardStoreState> | ((state: ClipboardStoreState) => Partial<ClipboardStoreState>)

/** 构造最小可用的剪贴板条目（仅含测试关注字段，其余按需 override）。 */
export function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    type: 'text',
    content: 'hello world',
    timestamp: Date.now(),
    pinned: false,
    favorited: false,
    tags: [],
    workspace: '',
    ...overrides,
  } as unknown as ClipboardItem
}

/** 每个用例前重置 store 到干净基线，并固定中文语言以保证文案断言确定。 */
export function resetStore(overrides: StorePatch = {}) {
  const current = useClipboardStore.getState()
  const baseline: Partial<ClipboardStoreState> = {
    history: [],
    filteredHistory: [],
    searchQuery: '',
    selectionMode: false,
    selectedIds: [],
    quickAddOpen: false,
    detailItemId: null,
    filterType: null,
    sortMode: 'newest',
    timeFilter: 'all',
    updateInfo: null,
    updateStatus: 'idle',
    updateDismissed: false,
    updateDownloadProgress: { receivedBytes: 0, totalBytes: null, percent: null },
    toast: null,
    settings: { ...current.settings, language: 'zh-CN' },
  }
  const patch = typeof overrides === 'function' ? overrides(current) : overrides
  useClipboardStore.setState({ ...baseline, ...patch })
}

/** vitest.setup.ts 的 Proxy stub：按属性返回稳定的 vi.fn()，可在此覆写返回值。 */
export function getElectronMock(): Record<string, Mock> {
  return window.electronAPI as unknown as Record<string, Mock>
}
