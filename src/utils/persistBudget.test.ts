import { describe, expect, it } from 'vitest'
import { fitHistoryToBudget, getHistoryItemByteSize, type BudgetableHistoryItem } from './persistBudget'

interface Item extends BudgetableHistoryItem {
  id: string
}

const makeItem = (id: string, payloadSize: number, overrides: Partial<Item> = {}): Item => ({
  id,
  content: 'x'.repeat(payloadSize),
  timestamp: Number(id.replace(/\D/g, '')) || 1,
  ...overrides,
})

/** 用真实 JSON 长度当测量器，尽量贴近 main.ts 的用法 */
const measureJson = (items: readonly Item[]) => Buffer.byteLength(JSON.stringify(items), 'utf8')

describe('fitHistoryToBudget', () => {
  it('leaves history untouched when it already fits', () => {
    const history = [makeItem('a1', 10), makeItem('a2', 10)]
    const result = fitHistoryToBudget(history, 10_000, measureJson)
    expect(result.dropped).toBe(0)
    expect(result.items).toEqual(history)
    expect(result.bytes).toBeLessThanOrEqual(10_000)
  })

  it('drops the oldest unprotected items until it fits', () => {
    const history = [makeItem('a1', 2_000), makeItem('a2', 2_000), makeItem('a3', 2_000), makeItem('a4', 2_000)]
    const budget = measureJson([history[2], history[3]]) // 只够留两条最新的
    const result = fitHistoryToBudget(history, budget, measureJson)

    expect(result.dropped).toBe(2)
    expect(result.items.map(item => item.id)).toEqual(['a3', 'a4'])
    expect(result.bytes).toBeLessThanOrEqual(budget)
  })

  it('never drops pinned or favorited items', () => {
    const pinned = makeItem('p1', 2_000, { pinned: true })
    const favorited = makeItem('f2', 2_000, { favorited: true })
    const plainOld = makeItem('a3', 2_000)
    const plainNew = makeItem('a4', 2_000)
    const history = [pinned, favorited, plainOld, plainNew]

    const budget = measureJson([pinned, favorited, plainNew])
    const result = fitHistoryToBudget(history, budget, measureJson)

    expect(result.dropped).toBe(1)
    expect(result.items.map(item => item.id).sort()).toEqual(['a4', 'f2', 'p1'])
  })

  it('gives up (dropped=0, still over budget) when every item is protected', () => {
    const history = [
      makeItem('p1', 5_000, { pinned: true }),
      makeItem('f2', 5_000, { favorited: true }),
    ]
    const result = fitHistoryToBudget(history, 1_000, measureJson)

    // 关键语义：受保护数据不静默丢弃，把"仍然超限"这个事实交回调用方去报错
    expect(result.dropped).toBe(0)
    expect(result.items).toHaveLength(2)
    expect(result.bytes).toBeGreaterThan(1_000)
  })

  it('does not mutate the caller array', () => {
    const history = [makeItem('a1', 2_000), makeItem('a2', 2_000)]
    const snapshot = [...history]
    fitHistoryToBudget(history, 100, measureJson)
    expect(history).toEqual(snapshot)
    expect(history).toHaveLength(2)
  })

  it('handles an empty history', () => {
    const result = fitHistoryToBudget([], 1_000, measureJson)
    expect(result).toEqual({ items: [], dropped: 0, bytes: 2 }) // '[]'
  })
})

describe('getHistoryItemByteSize', () => {
  it('counts html, rtf and attachment paths, not just plain text', () => {
    const plain = getHistoryItemByteSize({ content: '', timestamp: 1 })
    const rich = getHistoryItemByteSize({
      content: '',
      html: '<b>x</b>',
      rtf: '{\\rtf1}',
      files: ['C:\\a.png', 'C:\\b.png'],
      timestamp: 1,
    })
    expect(rich).toBeGreaterThan(plain)
  })
})
