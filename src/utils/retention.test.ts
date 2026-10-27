import { describe, expect, it } from 'vitest'
import { isVerificationCode, retainHistoryItems, type RetentionItem } from './retention'

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

  it('counts rich text and file metadata in the retention budget', () => {
    const result = retainHistoryItems([
      item('rich', 1000, { html: 'x'.repeat(8) }),
      item('plain', 900, { content: 'plain' }),
    ], {
      maxHistory: 50,
      autoDeleteDays: 0,
      verificationCodeTtlMinutes: 0,
      now,
      maxTextBytes: 12,
    })
    expect(result.map(value => value.id)).toEqual(['plain'])
  })

  // 回归（P0）：字节预算一旦被撑破，必须"停收"，不能"跳过该条继续收更旧的条目"。
  // 现状 continue 语义会把比超大条目更旧的内容重新塞回保留集，破坏"保留最新"的契约，
  // 且在真实数据（一条大截图 OCR 文本 + 若干老文本）下会让用户看到早已过期的内容。
  it('stops retaining older items once one item exceeds the text byte budget', () => {
    const result = retainHistoryItems([
      item('newest', 1000, { content: 'aaaa' }),
      item('oversized', 2000, { content: 'x'.repeat(40) }),
      item('older', 3000, { content: 'bb' }),
    ], { maxHistory: 50, autoDeleteDays: 0, verificationCodeTtlMinutes: 0, now, maxTextBytes: 10 })
    expect(result.map(value => value.id)).toEqual(['newest'])
  })
})

// 回归（P0）：验证码识别过宽 —— 纯数字不等于验证码。
// 现状 /^\d{4,8}$/ 会把 '2026'、'1234' 当验证码，导致这些条目被套用独立 TTL 提前删除（静默数据丢失）。
describe('verification code detection', () => {
  it('accepts realistic codes and rejects years, repeated digits and over-long numbers', () => {
    expect(isVerificationCode('482913')).toBe(true)
    expect(isVerificationCode('2026')).toBe(false)
    expect(isVerificationCode('1234')).toBe(false)
    expect(isVerificationCode('12')).toBe(false)
    expect(isVerificationCode('123456789')).toBe(false)
    expect(isVerificationCode('abc1234')).toBe(false)
  })
})
