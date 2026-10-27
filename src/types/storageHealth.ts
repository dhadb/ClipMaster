/**
 * 落盘健康状态（P0-1「存储健康度可见化」的 IPC 契约）。
 *
 * 唯一事实来源是 electron/main.ts:65-79 的 StorageHealth 与
 * electron/main.ts:702 的 getStorageHealthSnapshot()。渲染层只读不写，
 * 因此这里刻意不 import 任何 i18n / React 模块：electron/preload.ts 也会
 * 引用本文件，主进程侧类型图必须保持干净。
 */

/** safeStorage 可用性：encrypted=已加密 / plain=明文回退 / unknown=尚未探测成功 */
export type StorageEncryptionState = 'encrypted' | 'plain' | 'unknown'

export interface StorageHealth {
  /** 主数据文件读不出来，已改用 .bak 启动（loadData 里的 recoverWithBackup） */
  recoveredFromBackup: boolean
  /** 主文件存在但完全无法解析，且没有可用备份：本次启动为空历史 */
  loadFailed: boolean
  /** 主文件被 rename 隔离后的路径（loadData 里 `${dataPath}.corrupt-${ts}`） */
  corruptFilePath: string | null
  /** 最近一次保存时因超出体积预算被裁掉的记录条数（saveData 的 fitPersistedData） */
  trimmedOnSave: number
  /** 最近一次落盘错误的字符串摘要（主进程 String(err)） */
  lastError: string | null
  /** safeStorage 探测结果 */
  encryption: StorageEncryptionState
}
