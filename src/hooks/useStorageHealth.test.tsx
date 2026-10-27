// @vitest-environment jsdom
/**
 * 落盘健康的"实时"链路（P0-1 收尾）：主进程保存后推 `storage-health-changed`，
 * 渲染层不用重开窗口就能看到新的裁剪/恢复/报错提示。
 *
 * 这里锁四件事：
 *  1) 初始快照健康 → 提示条不占位；收到推送后文案变成「保存时裁剪了 N 条记录」；
 *  2) 卸载时必须退订，卸载后再有事件到达既不抛错也不再触发渲染（没有监听器泄漏）；
 *  3) 初始拉取失败时静默降级（保持 null），后续推送仍能补上状态；
 *  4) 推送先于初始快照到达时，不被更旧的基线覆盖。
 */
import '@testing-library/jest-dom/vitest'
import { act, render, screen, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StorageHealthBanner from '../components/StorageHealthBanner'
import { useClipboardStore } from '../store/clipboardStore'
import type { StorageHealth } from '../types/storageHealth'
import { useStorageHealth } from './useStorageHealth'

type HealthListener = (health: StorageHealth) => void

/** 可控的 preload 假件：让测试自己决定什么时候"主进程推送"。 */
function createElectronApiStub(initial: StorageHealth | Promise<StorageHealth>) {
  const listeners = new Set<HealthListener>()
  const unsubscribeSpy = vi.fn()
  const api = {
    getStorageHealth: typeof initial === 'object' && 'then' in initial
      ? vi.fn(() => initial)
      : vi.fn().mockResolvedValue(initial),
    onStorageHealthChanged: vi.fn((listener: HealthListener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        unsubscribeSpy()
      }
    }),
  }
  return {
    api,
    listeners,
    unsubscribeSpy,
    push(health: StorageHealth) {
      listeners.forEach(listener => listener(health))
    },
  }
}

function makeHealth(overrides: Partial<StorageHealth> = {}): StorageHealth {
  return {
    recoveredFromBackup: false,
    loadFailed: false,
    corruptFilePath: null,
    trimmedOnSave: 0,
    lastError: null,
    encryption: 'encrypted',
    ...overrides,
  }
}

function installApi(api: unknown) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
}

beforeEach(() => {
  // jsdom 的 navigator.language 是 en-US，固定中文以断言真实文案。
  useClipboardStore.setState(state => ({ settings: { ...state.settings, language: 'zh-CN' } }))
})

describe('useStorageHealth 实时推送', () => {
  it('收到 storage-health-changed 后，提示条从健康无提示变为显示裁剪条数', async () => {
    const stub = createElectronApiStub(makeHealth())
    installApi(stub.api)

    render(<StorageHealthBanner />)

    await waitFor(() => expect(stub.api.getStorageHealth).toHaveBeenCalledTimes(1))
    // 健康态：不占顶部空间。
    await waitFor(() => expect(screen.queryByTestId('storage-health-banner')).not.toBeInTheDocument())

    act(() => { stub.push(makeHealth({ trimmedOnSave: 3 })) })

    expect(screen.getByTestId('storage-health-issue-trimmed')).toHaveTextContent('保存时裁剪了 3 条记录')
  })

  it('卸载时退订；卸载后再触发事件不报错且不再触发渲染', () => {
    const stub = createElectronApiStub(makeHealth())
    installApi(stub.api)
    const captured: HealthListener[] = []

    let renders = 0
    const { unmount } = renderHook(() => {
      renders += 1
      return useStorageHealth()
    })

    expect(stub.api.onStorageHealthChanged).toHaveBeenCalledTimes(1)
    // 记下 hook 真实注册的回调，模拟"旧 preload 没真正移除监听"的泄漏场景。
    const listener = stub.api.onStorageHealthChanged.mock.calls[0][0]
    captured.push(listener)

    const rendersBeforeUnmount = renders
    unmount()

    expect(stub.unsubscribeSpy).toHaveBeenCalledTimes(1)
    expect(stub.listeners.size).toBe(0)

    expect(() => { captured.forEach(cb => cb(makeHealth({ trimmedOnSave: 5 }))) }).not.toThrow()
    expect(renders).toBe(rendersBeforeUnmount)
  })

  it('初始拉取失败时静默降级，之后仍能被推送补上状态', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stub = createElectronApiStub(Promise.reject(new Error('ipc unavailable')))
    installApi(stub.api)

    const { result } = renderHook(() => useStorageHealth())

    await waitFor(() => expect(errorSpy).toHaveBeenCalled())
    expect(result.current).toBeNull()

    act(() => { stub.push(makeHealth({ loadFailed: true, lastError: 'EACCES' })) })

    expect(result.current?.loadFailed).toBe(true)
    expect(result.current?.lastError).toBe('EACCES')
  })

  it('推送先于初始快照到达时，不会被更旧的基线覆盖', async () => {
    let resolveInitial: (health: StorageHealth) => void = () => {}
    const pending = new Promise<StorageHealth>(resolve => { resolveInitial = resolve })
    const stub = createElectronApiStub(pending)
    installApi(stub.api)

    const { result } = renderHook(() => useStorageHealth())

    act(() => { stub.push(makeHealth({ trimmedOnSave: 2 })) })
    expect(result.current?.trimmedOnSave).toBe(2)

    await act(async () => { resolveInitial(makeHealth()); await pending })

    expect(result.current?.trimmedOnSave).toBe(2)
  })
})
