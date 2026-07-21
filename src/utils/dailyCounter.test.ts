import { describe, expect, it } from 'vitest'
import { getLocalDateKey, normalizeDailyCounter } from './dailyCounter'

describe('daily privacy counter', () => {
  it('uses local calendar dates', () => {
    expect(getLocalDateKey(new Date(2026, 6, 21, 23, 59))).toBe('2026-07-21')
  })

  it('keeps todays count and resets stale or legacy values', () => {
    const now = new Date(2026, 6, 21, 0, 1)
    expect(normalizeDailyCounter('2026-07-21', 7, now)).toEqual({ date: '2026-07-21', count: 7 })
    expect(normalizeDailyCounter('2026-07-20', 99, now)).toEqual({ date: '2026-07-21', count: 0 })
    expect(normalizeDailyCounter(undefined, 99, now)).toEqual({ date: '2026-07-21', count: 0 })
  })
})
