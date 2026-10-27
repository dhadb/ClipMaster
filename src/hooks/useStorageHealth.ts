import { useEffect, useState } from 'react'
import type { StorageHealth } from '../types/storageHealth'
import { normalizeStorageHealth } from '../utils/storageHealth'

/**
 * 读取主进程的落盘健康快照，并订阅运行期变化。
 *
 * - enabled=false 时不发 IPC（组件把 health 当 prop 直接注入时用，测试与 Storybook 场景）；
 * - 返回 null 表示"尚未读到"，UI 应保持静默，而不是显示"一切正常"；
 * - 初始拉取只是首帧基线：失败时静默降级（保持 null、不抛错），后续推送仍能补上状态；
 * - 落盘裁剪 / 备份恢复 / 写盘报错发生在窗口开着的时候，主进程保存后会推
 *   `storage-health-changed`（electron/main.ts 的 emitStorageHealthIfChanged），
 *   否则用户必须重开窗口才看得到；
 * - 主进程 handler 见 electron/main.ts 的 `get-storage-health`。
 */
export function useStorageHealth(enabled = true): StorageHealth | null {
  const [health, setHealth] = useState<StorageHealth | null>(null)

  useEffect(() => {
    if (!enabled) return
    const api = window.electronAPI
    // 旧版 preload 没有该方法（升级后首帧），直接跳过而不是抛错。
    if (!api || typeof api.getStorageHealth !== 'function') return

    let active = true
    let pushed = false

    api.getStorageHealth()
      .then(raw => {
        // 推送先到就不要用更旧的基线快照覆盖它。
        if (active && !pushed) setHealth(normalizeStorageHealth(raw))
      })
      .catch((err: unknown) => {
        console.error('getStorageHealth failed:', err)
      })

    const unsubscribe = typeof api.onStorageHealthChanged === 'function'
      ? api.onStorageHealthChanged(raw => {
          if (!active) return
          pushed = true
          const next = normalizeStorageHealth(raw)
          if (next) setHealth(next)
        })
      : undefined

    return () => {
      active = false
      // 旧版 preload 可能返回非函数（升级期），退订失败也不能影响卸载流程。
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [enabled])

  return health
}
