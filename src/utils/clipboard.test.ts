import { describe, expect, it } from 'vitest'
import { MAX_TAGS, matchesClipboardQuery, normalizeTags } from './clipboard'

describe('normalizeTags', () => {
  it('trims, de-duplicates, and removes leading hashes', () => {
    expect(normalizeTags([' Work ', '#work', 'API docs', '', 42])).toEqual(['Work', 'API docs'])
  })

  it('limits the number of tags', () => {
    const tags = Array.from({ length: MAX_TAGS + 3 }, (_, index) => `tag-${index}`)
    expect(normalizeTags(tags)).toHaveLength(MAX_TAGS)
  })
})

describe('matchesClipboardQuery', () => {
  const item = {
    content: 'npm run build -- --publish never',
    type: 'code',
    tags: ['Release', 'Windows'],
  }

  it('searches content and tags with all query terms', () => {
    expect(matchesClipboardQuery(item, 'npm release')).toBe(true)
    expect(matchesClipboardQuery(item, 'npm linux')).toBe(false)
  })

  it('supports tag and type qualifiers', () => {
    expect(matchesClipboardQuery(item, '#release type:code')).toBe(true)
    expect(matchesClipboardQuery(item, '#release type:link')).toBe(false)
  })

  it('keeps hash-prefixed clipboard content searchable', () => {
    expect(matchesClipboardQuery({ content: '#FFAA00', type: 'color' }, '#ffaa')).toBe(true)
  })
})
