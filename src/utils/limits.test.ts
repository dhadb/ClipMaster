import { describe, expect, it } from 'vitest'
import {
  getBoundedImportSource,
  getImportedItemByteLength,
  getImportedItemsTotalByteLength,
  isImportedItemsWithinBudget,
  isTextWithinLimit,
  MAX_IMPORT_ITEMS,
  MAX_PERSISTED_DATA_BYTES,
  MAX_TEXT_BYTES,
} from './limits'

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

  it('counts text, html and rtf bytes per imported item', () => {
    expect(getImportedItemByteLength({ content: 'abc' })).toBe(3)
    expect(getImportedItemByteLength({ content: '你' })).toBe(3)
    expect(getImportedItemByteLength({ content: 'a', html: '<b>x</b>', rtf: '{\\rtf1}' })).toBe(1 + 8 + 7)
    expect(getImportedItemByteLength({ content: 42, html: null })).toBe(0)
  })

  it('sums every imported item for the aggregate budget check', () => {
    expect(getImportedItemsTotalByteLength([{ content: 'ab' }, { content: 'cde' }])).toBe(5)
  })

  it('rejects an import batch once the aggregate exceeds the persisted-data budget', () => {
    const halfBudget = Math.floor(MAX_PERSISTED_DATA_BYTES / 2)
    const within = [{ content: 'a'.repeat(halfBudget) }, { content: 'b'.repeat(halfBudget) }]
    const over = [{ content: 'a'.repeat(halfBudget) }, { content: 'b'.repeat(halfBudget + 8) }]
    expect(isImportedItemsWithinBudget(within)).toBe(true)
    expect(isImportedItemsWithinBudget(over)).toBe(false)
  })
})
