import { describe, expect, it } from 'vitest'
import { retainHistoryItems, type RetentionItem } from './retention'

const now = new Date(2026, 6, 21, 12).getTime()
const item = (id: string, ageMs: number, overrides: Partial<RetentionItem> = {}): RetentionItem => ({
  id,
  content: id,
  timestamp: now - ageMs,
  pinned: false,
  favorited: false,
  ...overrides,
})

describe('history retention', () => {
  it('expires verification codes independently and keeps protected items', () => {
    const result = retainHistoryItems([
      item('old', 40 * 24 * 60 * 60 * 1000),
      item('code', 11 * 60 * 1000, { content: '123456' }),
      item('pinned', 400 * 24 * 60 * 60 * 1000, { pinned: true }),
      item('fresh', 1000),
    ], { maxHistory: 50, autoDeleteDays: 30, verificationCodeTtlMinutes: 10, now })
    expect(result.map(value => value.id)).toEqual(['pinned', 'fresh'])
  })

  it('enforces total text bytes after priority ordering', () => {
    const result = retainHistoryItems([
      item('normal', 1000, { content: '1234' }),
      item('favorite', 2000, { content: '1234', favorited: true }),
    ], { maxHistory: 50, autoDeleteDays: 0, verificationCodeTtlMinutes: 0, now, maxTextBytes: 4 })
    expect(result.map(value => value.id)).toEqual(['favorite'])
  })
})
