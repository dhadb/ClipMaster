// Vitest 全局 setup。由 QA 负责扩展，其他角色不要覆盖整体结构。
//
// 注意：本文件在 **node 环境**下也会加载（纯逻辑测试），
// 因此任何 DOM API 的 polyfill 都必须先判断 `typeof window !== 'undefined'`，
// 否则会让 electron 侧/纯函数测试直接抛错。

// jest-dom 的 matcher 注册必须是**同步静态导入**：原先的 `void import(...)` 是异步的，
// 不保证在首个测试执行前完成注册，`toBeInTheDocument()` 会间歇性抛 "is not a function"。
// 该包只做 expect.extend，不触碰 window，因此在 node 环境下加载同样安全。
import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined') {
  // @testing-library/react 在 globals:false 时不会自动 cleanup，必须显式注册，
  // 否则同一文件内多个 render 会互相污染（上一个测试的 DOM 残留）。
  // 顶层 await 保证注册早于任何测试执行。
  const { cleanup } = await import('@testing-library/react')
  const { afterEach, vi } = await import('vitest')

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // --- matchMedia ---------------------------------------------------------
  // src/App.tsx:57 读取 prefers-color-scheme，:86 `mq.addEventListener('change', handler)` 订阅；
  // 原 stub 的 addEventListener 是空函数且不是 vi.fn，既不能触发也覆写不了。
  // 这里改成可控版本：默认 matches=false（浅色），用例可用
  //   vi.mocked(window.matchMedia).mockReturnValue({ ...stub, matches: true } as MediaQueryList)
  // 覆写。
  type MediaListener = (event: MediaQueryListEvent) => void
  const createMediaQueryList = (query: string): MediaQueryList => {
    const listeners = new Set<MediaListener>()
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: (listener: MediaListener) => listeners.add(listener),
      removeListener: (listener: MediaListener) => listeners.delete(listener),
      addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
      dispatchEvent: (event: Event) => {
        listeners.forEach(listener => listener(event as MediaQueryListEvent))
        return true
      },
    } as MediaQueryList
  }

  window.matchMedia = vi.fn((query: string) => createMediaQueryList(query)) as unknown as typeof window.matchMedia

  // --- ResizeObserver / IntersectionObserver ------------------------------
  // 全仓 grep 确认 src/components 未使用这两个 API；保留 stub 仅作防御，
  // 未来引入虚拟列表时不必再改 setup 文件。
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub
  }

  if (!('IntersectionObserver' in window)) {
    class IntersectionObserverStub {
      root = null
      rootMargin = ''
      thresholds: number[] = []
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    ;(window as unknown as Record<string, unknown>).IntersectionObserver = IntersectionObserverStub
  }

  // --- window.electronAPI -------------------------------------------------
  // electron/preload.ts:82-114 暴露 33 个方法，jsdom 里全部不存在；
  // src/App.tsx 与 7 个组件在首次渲染即调用（getSettings 等），缺 stub 直接 TypeError。
  // 用按属性缓存的 Proxy：同一方法句柄稳定，可直接 vi.mocked(window.electronAPI.getSettings).mockResolvedValue(...) 覆写。
  const electronApiCache = new Map<string, ReturnType<typeof vi.fn>>()
  const electronApiStub = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (!electronApiCache.has(property)) {
          electronApiCache.set(property, vi.fn().mockResolvedValue(undefined))
        }
        return electronApiCache.get(property)
      },
    },
  )
  ;(window as unknown as Record<string, unknown>).electronAPI = electronApiStub

  // --- 长列表滚动 ---------------------------------------------------------
  // jsdom 未实现 scrollIntoView / scrollTo，会打印 "Not implemented" 噪声。
  if (typeof Element !== 'undefined') {
    Element.prototype.scrollIntoView = vi.fn()
  }
  Object.defineProperty(window, 'scrollTo', { writable: true, configurable: true, value: vi.fn() })
}
