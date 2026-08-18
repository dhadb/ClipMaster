import { describe, expect, it, vi } from 'vitest'
import { filterHistory, useClipboardStore, type ClipboardItem } from './clipboardStore'

function item(id: string, timestamp: number, overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id,
    content: id,
    type: 'text',
    timestamp,
    firstTimestamp: timestamp,
    pinned: false,
    favorited: false,
    copyCount: 1,
    ...overrides,
  }
}

describe('filterHistory', () => {
  it('combines favorites, type, and query filters', () => {
    const history = [
      item('alpha', 3, { type: 'code', favorited: true, tags: ['release'] }),
      item('beta', 2, { type: 'link', favorited: true }),
      item('gamma', 1, { type: 'code' }),
    ]
    expect(filterHistory(history, 'favorites', '#release', 'code', 'newest', 'all').map(value => value.id)).toEqual(['alpha'])
  })

  it('keeps pinned records first and sorts the remaining records by usage', () => {
    const history = [
      item('recent', 30, { copyCount: 2 }),
      item('popular', 20, { copyCount: 10 }),
      item('pinned', 10, { pinned: true }),
    ]
    expect(filterHistory(history, 'history', '', null, 'most-used', 'all').map(value => value.id)).toEqual(['pinned', 'popular', 'recent'])
  })

  it('limits results to today', () => {
    const now = Date.now()
    const yesterday = now - 36 * 60 * 60 * 1000
    expect(filterHistory([item('today', now), item('old', yesterday)], 'history', '', null, 'newest', 'today').map(value => value.id)).toEqual(['today'])
  })

  it('resets search, filters, and sort mode together', () => {
    const store = useClipboardStore.getState()
    store.setHistory([item('recent', 3), item('old', 1)])
    store.setSearchQuery('recent')
    store.setFilterType('text')
    store.setTimeFilter('week')
    store.setSortMode('most-used')

    useClipboardStore.getState().resetFilters()
    const state = useClipboardStore.getState()

    expect(state.searchQuery).toBe('')
    expect(state.filterType).toBeNull()
    expect(state.timeFilter).toBe('all')
    expect(state.sortMode).toBe('newest')
    expect(state.filteredHistory.map(value => value.id)).toEqual(['recent', 'old'])
  })
})

describe('clipboard stack', () => {
  it('keeps queue order, prevents duplicates, and removes stale items', () => {
    const store = useClipboardStore.getState()
    store.setHistory([item('first', 2), item('second', 1)])
    store.clearStack()

    store.addToStack('second')
    store.addToStack('first')
    store.addToStack('second')
    expect(useClipboardStore.getState().stackIds).toEqual(['second', 'first'])

    useClipboardStore.getState().setHistory([item('first', 2)])
    expect(useClipboardStore.getState().stackIds).toEqual(['first'])
  })

  it('removes an item after copying the next queue entry', async () => {
    vi.stubGlobal('window', { electronAPI: { copyToClipboard: vi.fn().mockResolvedValue([]) } })
    const store = useClipboardStore.getState()
    store.setHistory([item('first', 2), item('second', 1)])
    store.clearStack()
    store.addToStack('first')
    store.addToStack('second')

    await store.copyNextStackItem()
    expect(useClipboardStore.getState().stackIds).toEqual(['second'])
    vi.unstubAllGlobals()
  })
})
