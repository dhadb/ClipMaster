import { describe, expect, it } from 'vitest'
import { WeightedLruCache } from './lru'

describe('WeightedLruCache', () => {
  it('evicts the least recently used values by count and weight', () => {
    const cache = new WeightedLruCache<string>(2, 5)
    cache.set('a', 'A', 2)
    cache.set('b', 'B', 2)
    expect(cache.get('a')).toBe('A')
    cache.set('c', 'C', 2)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe('A')
    expect(cache.get('c')).toBe('C')
  })

  it('does not retain a value larger than the entire cache budget', () => {
    const cache = new WeightedLruCache<string>(2, 5)
    cache.set('large', 'value', 6)
    expect(cache.get('large')).toBeUndefined()
  })
})
