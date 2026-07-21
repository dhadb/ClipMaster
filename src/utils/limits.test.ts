import { describe, expect, it } from 'vitest'
import { getBoundedImportSource, isTextWithinLimit, MAX_IMPORT_ITEMS, MAX_TEXT_BYTES } from './limits'

describe('clipboard limits', () => {
  it('measures UTF-8 bytes instead of UTF-16 characters', () => {
    expect(isTextWithinLimit('a'.repeat(MAX_TEXT_BYTES))).toBe(true)
    expect(isTextWithinLimit('你'.repeat(Math.floor(MAX_TEXT_BYTES / 3) + 1))).toBe(false)
  })

  it('slices import arrays before callers map or sanitize them', () => {
    const items = Array.from({ length: MAX_IMPORT_ITEMS + 25 }, (_, index) => index)
    expect(getBoundedImportSource({ items })).toHaveLength(MAX_IMPORT_ITEMS)
    expect(getBoundedImportSource({ history: items })).toHaveLength(MAX_IMPORT_ITEMS)
    expect(getBoundedImportSource({ nope: items })).toEqual([])
  })
})
