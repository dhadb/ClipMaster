// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import SearchBar from './SearchBar'
import { useClipboardStore, type ClipboardItem } from '../store/clipboardStore'
import { makeItem, resetStore } from '../test/helpers'

function seedHistory(): ClipboardItem[] {
  const now = Date.now()
  const items: ClipboardItem[] = [
    makeItem({ id: 't1', type: 'text', content: 'hello world', timestamp: now - 60_000 }),
    makeItem({ id: 't2', type: 'link', content: 'https://example.com', timestamp: now - 120_000 }),
    makeItem({ id: 't3', type: 'text', content: 'old note', timestamp: now - 10 * 86_400_000 }),
  ]
  // 必须走 setHistory：它会重建 store 内部的搜索索引，直接 setState 不会
  useClipboardStore.getState().setHistory(items)
  return items
}

function getInput() {
  // input type="search" 的 ARIA 角色是 searchbox 而非 textbox
  return screen.getByRole('searchbox', { name: '搜索内容或 #标签...' })
}

beforeEach(() => {
  resetStore()
})

describe('SearchBar 搜索与筛选', () => {
  it('输入防抖后回写搜索词，并按关键词过滤结果', async () => {
    seedHistory()
    render(<SearchBar />)
    const input = getInput()

    fireEvent.change(input, { target: { value: 'hello' } })
    // 防抖窗口内不立即回写 store
    expect(useClipboardStore.getState().searchQuery).toBe('')

    await waitFor(() => expect(useClipboardStore.getState().searchQuery).toBe('hello'))
    expect(useClipboardStore.getState().filteredHistory.map(item => item.id)).toEqual(['t1'])
    expect(screen.getByText('显示 1 / 3 条')).toBeInTheDocument()
  })

  it('清空按钮：清空关键词、清空 store 查询并重新聚焦输入框', async () => {
    seedHistory()
    render(<SearchBar />)
    const input = getInput()

    fireEvent.change(input, { target: { value: 'hello' } })
    await waitFor(() => expect(useClipboardStore.getState().searchQuery).toBe('hello'))

    fireEvent.click(screen.getByTitle('清空搜索'))
    expect(useClipboardStore.getState().searchQuery).toBe('')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('类型 + 时间 + 排序组合筛选，重置后恢复全部', () => {
    seedHistory()
    render(<SearchBar />)

    // 无筛选时展示总数
    expect(screen.getByText('共 3 条记录')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('筛选与排序'))
    fireEvent.click(screen.getByRole('button', { name: '文本' }))
    expect(useClipboardStore.getState().filterType).toBe('text')
    expect(useClipboardStore.getState().filteredHistory.map(item => item.id)).toEqual(['t1', 't3'])

    fireEvent.click(screen.getByRole('button', { name: '今天' }))
    expect(useClipboardStore.getState().timeFilter).toBe('today')
    expect(useClipboardStore.getState().filteredHistory.map(item => item.id)).toEqual(['t1'])

    fireEvent.click(screen.getByRole('button', { name: '最早' }))
    expect(useClipboardStore.getState().sortMode).toBe('oldest')

    fireEvent.click(screen.getByRole('button', { name: '重置' }))
    const state = useClipboardStore.getState()
    expect(state.searchQuery).toBe('')
    expect(state.filterType).toBeNull()
    expect(state.timeFilter).toBe('all')
    expect(state.sortMode).toBe('newest')
    expect(state.filteredHistory).toHaveLength(3)
    expect(screen.getByText('共 3 条记录')).toBeInTheDocument()
  })
})
