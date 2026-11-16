// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import UpdateBanner from './UpdateBanner'
import { useClipboardStore } from '../store/clipboardStore'
import { getElectronMock, resetStore } from '../test/helpers'

const updateInfo = {
  currentVersion: '5.0.0',
  latestVersion: '5.1.0',
  hasUpdate: true,
  releaseUrl: 'https://github.com/clipmaster/releases/v5.1.0',
  downloadUrl: 'https://example.com/download',
  releaseNotes: 'bug fixes',
  publishedAt: null,
}

beforeEach(() => {
  resetStore({ updateInfo, updateStatus: 'available' })
})

describe('UpdateBanner 更新状态展示', () => {
  it('available：展示新版本与查看/下载入口，下载后进入已下载态', async () => {
    render(<UpdateBanner />)
    expect(screen.getByText('ClipMaster v5.1.0 已发布')).toBeInTheDocument()
    expect(screen.getByTitle('关闭更新提示')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('查看'))
    expect(getElectronMock().openExternalUrl).toHaveBeenCalledWith(updateInfo.releaseUrl)

    fireEvent.click(screen.getByRole('button', { name: '下载更新' }))
    await waitFor(() => expect(getElectronMock().downloadUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useClipboardStore.getState().updateStatus).toBe('downloaded'))
    expect(screen.getByText('更新已下载')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '安装并重启' })).toBeInTheDocument()
  })

  it('downloading：展示进度且不提供下载/安装按钮（不可重复触发）', () => {
    resetStore({ updateInfo, updateStatus: 'downloading', updateDownloadProgress: { receivedBytes: 100, totalBytes: 238, percent: 42 } })
    render(<UpdateBanner />)
    expect(screen.getByText('已下载 42%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下载更新' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '安装并重启' })).not.toBeInTheDocument()
    expect(screen.getByTitle('关闭更新提示')).toBeInTheDocument()
  })

  it('downloading 无进度时展示“正在下载更新”', () => {
    resetStore({ updateInfo, updateStatus: 'downloading', updateDownloadProgress: { receivedBytes: 0, totalBytes: null, percent: null } })
    render(<UpdateBanner />)
    expect(screen.getByText('正在下载更新')).toBeInTheDocument()
  })

  it('downloaded：安装按钮触发 installUpdate', async () => {
    resetStore({ updateInfo, updateStatus: 'downloaded' })
    render(<UpdateBanner />)
    expect(screen.getByText('更新已下载')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '安装并重启' }))
    await waitFor(() => expect(getElectronMock().installUpdate).toHaveBeenCalledTimes(1))
  })

  it('installing：仅展示安装中，无下载/安装按钮', () => {
    resetStore({ updateInfo, updateStatus: 'installing' })
    render(<UpdateBanner />)
    expect(screen.getByText('正在安装更新')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下载更新' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '安装并重启' })).not.toBeInTheDocument()
  })

  it('已忽略、错误态或空闲态不渲染横幅', () => {
    resetStore({ updateInfo, updateStatus: 'error' })
    const errorView = render(<UpdateBanner />)
    expect(errorView.container).toBeEmptyDOMElement()

    resetStore({ updateInfo, updateStatus: 'available', updateDismissed: true })
    const dismissedView = render(<UpdateBanner />)
    expect(dismissedView.container).toBeEmptyDOMElement()

    resetStore({ updateInfo: null, updateStatus: 'idle' })
    const idleView = render(<UpdateBanner />)
    expect(idleView.container).toBeEmptyDOMElement()
  })

  it('点击关闭提示后横幅立即卸载', () => {
    const { container } = render(<UpdateBanner />)
    fireEvent.click(screen.getByTitle('关闭更新提示'))
    expect(useClipboardStore.getState().updateDismissed).toBe(true)
    expect(container).toBeEmptyDOMElement()
  })
})
