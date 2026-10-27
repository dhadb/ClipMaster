import { describe, expect, it } from 'vitest'
import {
  buildStorageHealthIssues,
  getStorageHealthTone,
  normalizeEncryption,
  normalizeStorageHealth,
  summarizeLastError,
} from './storageHealth'
import type { StorageHealth } from '../types/storageHealth'

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

describe('normalizeStorageHealth（IPC 边界防御）', () => {
  it('非对象输入返回 null，让 UI 保持静默而不是误报健康', () => {
    expect(normalizeStorageHealth(undefined)).toBeNull()
    expect(normalizeStorageHealth(null)).toBeNull()
    expect(normalizeStorageHealth('ok')).toBeNull()
  })

  it('字段缺失/类型漂移时落到安全默认值', () => {
    expect(normalizeStorageHealth({})).toEqual({
      recoveredFromBackup: false,
      loadFailed: false,
      corruptFilePath: null,
      trimmedOnSave: 0,
      lastError: null,
      encryption: 'unknown',
    })
  })

  it('trimmedOnSave 取整并拒绝负数/NaN，避免 >0 判断被脏数据骗过', () => {
    expect(normalizeStorageHealth({ trimmedOnSave: 3.9 })!.trimmedOnSave).toBe(3)
    expect(normalizeStorageHealth({ trimmedOnSave: -5 })!.trimmedOnSave).toBe(0)
    expect(normalizeStorageHealth({ trimmedOnSave: Number.NaN })!.trimmedOnSave).toBe(0)
    expect(normalizeStorageHealth({ trimmedOnSave: '9' })!.trimmedOnSave).toBe(0)
  })

  it('只认白名单内的加密状态', () => {
    expect(normalizeEncryption('encrypted')).toBe('encrypted')
    expect(normalizeEncryption('plain')).toBe('plain')
    expect(normalizeEncryption('whatever')).toBe('unknown')
    expect(normalizeEncryption(undefined)).toBe('unknown')
  })

  it('空白字符串视为"没有值"', () => {
    const health = normalizeStorageHealth({ lastError: '   ', corruptFilePath: '' })
    expect(health?.lastError).toBeNull()
    expect(health?.corruptFilePath).toBeNull()
  })
})

describe('summarizeLastError', () => {
  it('压平换行堆栈，避免单行提示被撑破', () => {
    expect(summarizeLastError('Error: EACCES\n  at save (main.ts:748)')).toBe('Error: EACCES at save (main.ts:748)')
  })

  it('超长截断并补省略号', () => {
    const summary = summarizeLastError('x'.repeat(400), 10)
    expect(summary).toHaveLength(10)
    expect(summary?.endsWith('…')).toBe(true)
  })

  it('空值返回 null', () => {
    expect(summarizeLastError(null)).toBeNull()
    expect(summarizeLastError('')).toBeNull()
    expect(summarizeLastError(undefined)).toBeNull()
  })
})

describe('buildStorageHealthIssues（状态 → 用户可见问题）', () => {
  it('一切正常时没有提示', () => {
    expect(buildStorageHealthIssues(makeHealth())).toEqual([])
    expect(buildStorageHealthIssues(null)).toEqual([])
  })

  it('严重度与顺序固定：loadFailed → recovered → trimmed → encryption', () => {
    const issues = buildStorageHealthIssues(makeHealth({
      loadFailed: true,
      recoveredFromBackup: true,
      trimmedOnSave: 12,
      encryption: 'plain',
    }))
    expect(issues.map(issue => issue.id)).toEqual(['loadFailed', 'recoveredFromBackup', 'trimmed', 'encryption'])
    expect(issues.map(issue => issue.tone)).toEqual(['danger', 'warning', 'warning', 'warning'])
  })

  it('trimmedOnSave 携带 count 插值参数', () => {
    const [issue] = buildStorageHealthIssues(makeHealth({ trimmedOnSave: 42 }))
    expect(issue.id).toBe('trimmed')
    expect(issue.params).toEqual({ count: 42 })
  })

  it('encryption=unknown 走 info 级提示而非 warning', () => {
    const [issue] = buildStorageHealthIssues(makeHealth({ encryption: 'unknown' }))
    expect(issue.id).toBe('encryption')
    expect(issue.tone).toBe('info')
  })
})

describe('getStorageHealthTone', () => {
  it('取最高严重度', () => {
    expect(getStorageHealthTone(buildStorageHealthIssues(makeHealth({ encryption: 'unknown' })))).toBe('info')
    expect(getStorageHealthTone(buildStorageHealthIssues(makeHealth({ trimmedOnSave: 1 })))).toBe('warning')
    expect(getStorageHealthTone(buildStorageHealthIssues(makeHealth({ loadFailed: true, trimmedOnSave: 1 })))).toBe('danger')
  })

  it('空列表返回 null（提示条不渲染）', () => {
    expect(getStorageHealthTone([])).toBeNull()
  })
})
