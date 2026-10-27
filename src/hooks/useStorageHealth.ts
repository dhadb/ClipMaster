import { useEffect, useState } from 'react'
import type { StorageHealth } from '../types/storageHealth'
import { normalizeStorageHealth } from '../utils/storageHealth'

/**
 * 读取主进程的落盘健康快照。
 *
 * - enabled=false 时不发 IPC（组件把 health 当 prop 直接注入时用，测试与 Storybook 场景）；
 * - 返回 null 表示"尚未读到"，UI 应保持静默，而不是显示"一切正常"；
 * - 主进程 handler 见 electron/main.ts:2163 `get-storage-health`。
 */
export function useStorageHealth(enabled = true): StorageHealth | null {
  const [health, setHealth] = useState<StorageHealth | null>(null)

  useEffect(() => {
    if (!enabled) return
    const api = window.electronAPI
    // 旧版 preload 没有该方法（升级后首帧），直接跳过而不是抛错。
    if (!api || typeof api.getStorageHealth !== 'function') return

    let active = true
    api.getStorageHealth()
      .then(raw => {
        if (active) setHealth(normalizeStorageHealth(raw))
      })
      .catch((err: unknown) => {
        console.error('getStorageHealth failed:', err)
      })

    return () => { active = false }
  }, [enabled])

  return health
}
