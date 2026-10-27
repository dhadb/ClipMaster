import type { StorageEncryptionState, StorageHealth } from '../types/storageHealth'
import type { TranslationKey } from '../i18n'

/**
 * 把 StorageHealth 翻译成"给用户看的问题列表"的纯函数层。
 *
 * 单独成文件（而不是写在组件里）的原因：
 *  1) 六种异常组合的判定优先级需要单测锁死，组件测试只负责"看得见"；
 *  2) IPC 返回的是主进程的 JSON，字段缺失/类型漂移必须在进入 UI 前归一化，
 *     否则 `trimmedOnSave > 0` 这类判断会因 undefined 而静默失效。
 */

export type StorageHealthTone = 'danger' | 'warning' | 'info'

export interface StorageHealthIssue {
  /** 同一时刻每类最多一条，用作 React key 与测试锚点 */
  id: 'loadFailed' | 'recoveredFromBackup' | 'trimmed' | 'encryption'
  tone: StorageHealthTone
  titleKey: TranslationKey
  detailKey: TranslationKey
  /** 文案插值参数（目前只有 trimmed 的 {count}） */
  params?: Record<string, string | number>
}

/** 折叠态下 lastError 的截断长度：主进程返回的是 String(err)，可能带完整堆栈 */
const LAST_ERROR_LIMIT = 180

const TONE_RANK: Record<StorageHealthTone, number> = { info: 0, warning: 1, danger: 2 }

export function normalizeEncryption(value: unknown): StorageEncryptionState {
  if (value === 'encrypted' || value === 'plain') return value
  return 'unknown'
}

/**
 * IPC 边界的防御性归一化。返回 null 表示"还没拿到状态"（区别于"拿到了且一切正常"），
 * 二者在 UI 上必须区分：前者什么都不显示，后者显示健康态。
 */
export function normalizeStorageHealth(raw: unknown): StorageHealth | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Record<string, unknown>
  const trimmed = typeof value.trimmedOnSave === 'number' && Number.isFinite(value.trimmedOnSave)
    ? Math.max(0, Math.floor(value.trimmedOnSave))
    : 0
  const lastError = typeof value.lastError === 'string' ? value.lastError.trim() : ''
  const corruptFilePath = typeof value.corruptFilePath === 'string' ? value.corruptFilePath.trim() : ''

  return {
    recoveredFromBackup: value.recoveredFromBackup === true,
    loadFailed: value.loadFailed === true,
    corruptFilePath: corruptFilePath || null,
    trimmedOnSave: trimmed,
    lastError: lastError || null,
    encryption: normalizeEncryption(value.encryption),
  }
}

/** 压平空白并截断：lastError 常带换行堆栈，直接塞进单行提示会撑破布局 */
export function summarizeLastError(message: string | null | undefined, limit = LAST_ERROR_LIMIT): string | null {
  if (typeof message !== 'string') return null
  const collapsed = message.replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  if (collapsed.length <= limit) return collapsed
  return `${collapsed.slice(0, Math.max(1, limit - 1))}…`
}

/**
 * 有序的问题列表：越靠前越需要用户立刻知道。
 * loadFailed（历史没了）→ recoveredFromBackup（可能丢最近改动）→ trimmed（丢旧记录）→ encryption。
 */
export function buildStorageHealthIssues(health: StorageHealth | null | undefined): StorageHealthIssue[] {
  if (!health) return []

  const issues: StorageHealthIssue[] = []
  if (health.loadFailed) {
    issues.push({
      id: 'loadFailed',
      tone: 'danger',
      titleKey: 'storageHealth.loadFailed',
      detailKey: 'storageHealth.loadFailedDesc',
    })
  }
  if (health.recoveredFromBackup) {
    issues.push({
      id: 'recoveredFromBackup',
      tone: 'warning',
      titleKey: 'storageHealth.recoveredFromBackup',
      detailKey: 'storageHealth.recoveredFromBackupDesc',
    })
  }
  if (health.trimmedOnSave > 0) {
    issues.push({
      id: 'trimmed',
      tone: 'warning',
      titleKey: 'storageHealth.trimmed',
      detailKey: 'storageHealth.trimmedDesc',
      params: { count: health.trimmedOnSave },
    })
  }
  if (health.encryption === 'plain') {
    issues.push({
      id: 'encryption',
      tone: 'warning',
      titleKey: 'storageHealth.encryptionPlain',
      detailKey: 'storageHealth.encryptionPlainDesc',
    })
  } else if (health.encryption === 'unknown') {
    issues.push({
      id: 'encryption',
      tone: 'info',
      titleKey: 'storageHealth.encryptionUnknown',
      detailKey: 'storageHealth.encryptionUnknownDesc',
    })
  }
  return issues
}

/** 整条提示的严重度 = 最高级别的单条问题；空列表返回 null（= 无需展示） */
export function getStorageHealthTone(issues: readonly StorageHealthIssue[]): StorageHealthTone | null {
  return issues.reduce<StorageHealthTone | null>((worst, issue) => {
    if (!worst) return issue.tone
    return TONE_RANK[issue.tone] > TONE_RANK[worst] ? issue.tone : worst
  }, null)
}
