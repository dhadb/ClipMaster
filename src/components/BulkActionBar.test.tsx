// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import BulkActionBar from './BulkActionBar'
import { useClipboardStore, type ClipboardItem } from '../store/clipboardStore'
import { getElectronMock, makeItem, resetStore } from '../test/helpers'

function seedSelection(favorited = false): ClipboardItem[] {
  const items: ClipboardItem[] = [
    makeItem({ id: 'a', content: 'first', favorited }),
    makeItem({ id: 'b', content: 'second', favorited }),
  ]
  resetStore({ history: items, filteredHistory: items, selectionMode: true, selectedIds: ['a', 'b'] })
  return items
}

beforeEach(() => {
  resetStore()
})

describe('BulkActionBar 批量操作', () => {
  it('非多选模式不渲染任何操作', () => {
    resetStore({ selectionMode: false, selectedIds: [] })
    const { container } = render(<BulkActionBar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('空选时危险/批量按钮禁用，不可进入删除确认', () => {
    resetStore({ history: [], filteredHistory: [], selectionMode: true, selectedIds: [] })
    render(<BulkActionBar />)
    expect(screen.getByText('已选 0 条')).toBeInTheDocument()
    expect(screen.getByTitle('删除所选')).toBeDisabled()
    expect(screen.getByTitle('批量添加标签')).toBeDisabled()
    expect(screen.getByTitle('加入收藏夹')).toBeDisabled()
    expect(screen.getByTitle('加入粘贴栈')).toBeDisabled()
    expect(screen.queryByText(/删除 \d+ 条？/)).not.toBeInTheDocument()
    expect(getElectronMock().deleteItems).not.toHaveBeenCalled()
  })

  it('批量删除需二次确认：取消不删除，确认后调用删除并退出多选', async () => {
    const items = seedSelection()
    getElectronMock().deleteItems.mockResolvedValue({ deleted: items, history: [] })
    render(<BulkActionBar />)
    expect(screen.getByText('已选 2 条')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('删除所选'))
    expect(screen.getByText('删除 2 条？')).toBeInTheDocument()
    expect(getElectronMock().deleteItems).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('取消'))
    expect(screen.queryByText('删除 2 条？')).not.toBeInTheDocument()
    expect(getElectronMock().deleteItems).not.toHaveBeenCalled()

    // 再次点击删除 → 打开确认框；确认按钮与删除按钮同名（title 均为“删除所选”），再点一次即确认
    fireEvent.click(screen.getByTitle('删除所选'))
    expect(screen.getByText('删除 2 条？')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('删除所选'))
    await waitFor(() => expect(getElectronMock().deleteItems).toHaveBeenCalledWith(['a', 'b']))
    await waitFor(() => {
      const state = useClipboardStore.getState()
      expect(state.selectedIds).toEqual([])
      expect(state.selectionMode).toBe(false)
    })
  })

  it('批量收藏：未全部收藏时点击触发 favorited: true', async () => {
    seedSelection()
    getElectronMock().batchUpdateItems.mockResolvedValue([])
    render(<BulkActionBar />)
    fireEvent.click(screen.getByTitle('加入收藏夹'))
    await waitFor(() =>
      expect(getElectronMock().batchUpdateItems).toHaveBeenCalledWith(['a', 'b'], { favorited: true, addTags: [] }),
    )
  })

  it('已全部收藏时点击触发 favorited: false（取消收藏）', async () => {
    seedSelection(true)
    getElectronMock().batchUpdateItems.mockResolvedValue([])
    render(<BulkActionBar />)
    fireEvent.click(screen.getByTitle('移出收藏夹'))
    await waitFor(() =>
      expect(getElectronMock().batchUpdateItems).toHaveBeenCalledWith(['a', 'b'], { favorited: false, addTags: [] }),
    )
  })
})
