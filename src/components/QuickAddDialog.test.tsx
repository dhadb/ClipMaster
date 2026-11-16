// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import QuickAddDialog from './QuickAddDialog'
import { useClipboardStore } from '../store/clipboardStore'
import { getElectronMock, resetStore } from '../test/helpers'

const CONTENT_PLACEHOLDER = '输入要长期保存的内容...'

function openDialog() {
  act(() => {
    useClipboardStore.getState().setQuickAddOpen(true)
  })
}

function fillContent(value: string) {
  fireEvent.change(screen.getByPlaceholderText(CONTENT_PLACEHOLDER), { target: { value } })
}

beforeEach(() => {
  resetStore()
})

describe('QuickAddDialog 新建片段', () => {
  it('关闭时不渲染；打开后展示对话框并聚焦内容输入框', () => {
    render(<QuickAddDialog />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    openDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('新建片段')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(CONTENT_PLACEHOLDER)).toHaveFocus()
  })

  it('内容为空时保存按钮禁用，点击取消关闭对话框', () => {
    openDialog()
    render(<QuickAddDialog />)

    expect(screen.getByRole('button', { name: '保存片段' })).toBeDisabled()
    fireEvent.click(screen.getByText('取消'))
    expect(useClipboardStore.getState().quickAddOpen).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('提交调用 createItem，成功后关闭并打开详情', async () => {
    openDialog()
    getElectronMock().createItem.mockResolvedValue({ itemId: 'new-1', created: true, history: [] })
    render(<QuickAddDialog />)

    fillContent('常用回复语')
    fireEvent.click(screen.getByRole('button', { name: '保存片段' }))

    await waitFor(() => expect(getElectronMock().createItem).toHaveBeenCalledTimes(1))
    expect(getElectronMock().createItem).toHaveBeenCalledWith({
      content: '常用回复语',
      tags: [],
      pinned: false,
      favorited: false,
    })
    await waitFor(() => expect(useClipboardStore.getState().quickAddOpen).toBe(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useClipboardStore.getState().detailItemId).toBe('new-1')
  })

  it('Ctrl+Enter 可提交', async () => {
    openDialog()
    getElectronMock().createItem.mockResolvedValue({ itemId: 'new-2', created: true, history: [] })
    render(<QuickAddDialog />)

    fillContent('快捷键提交的内容')
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    await waitFor(() =>
      expect(getElectronMock().createItem).toHaveBeenCalledWith({
        content: '快捷键提交的内容',
        tags: [],
        pinned: false,
        favorited: false,
      }),
    )
  })

  it('再次打开时表单已重置', async () => {
    openDialog()
    getElectronMock().createItem.mockResolvedValue({ itemId: 'new-3', created: true, history: [] })
    render(<QuickAddDialog />)

    fillContent('临时内容')
    fireEvent.click(screen.getByRole('button', { name: '保存片段' }))
    await waitFor(() => expect(useClipboardStore.getState().quickAddOpen).toBe(false))

    openDialog()
    expect(screen.getByPlaceholderText(CONTENT_PLACEHOLDER)).toHaveValue('')
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true)
  })

  it('保存失败时提示错误且对话框保持打开', async () => {
    openDialog()
    getElectronMock().createItem.mockRejectedValueOnce(new Error('boom'))
    render(<QuickAddDialog />)

    fillContent('会失败的内容')
    fireEvent.click(screen.getByRole('button', { name: '保存片段' }))

    expect(await screen.findByText('保存失败，请稍后再试')).toBeInTheDocument()
    expect(useClipboardStore.getState().quickAddOpen).toBe(true)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
