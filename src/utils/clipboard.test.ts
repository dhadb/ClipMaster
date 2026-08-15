import { describe, expect, it } from 'vitest'
import { createClipboardSearchIndex, MAX_TAGS, matchesClipboardQuery, normalizeTags, searchClipboardIndex } from './clipboard'

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

  it('supports token-level fuzzy matching and local pinyin matching', () => {
    expect(matchesClipboardQuery({ content: 'git push origin main', type: 'code' }, 'git pu')).toBe(true)
    expect(matchesClipboardQuery({ content: '部署文档', type: 'text' }, 'bswd')).toBe(true)
  })

  it('supports source application qualifiers', () => {
    expect(matchesClipboardQuery({ content: 'npm run build', type: 'code', sourceApplication: 'WindowsTerminal.exe' }, 'app:terminal')).toBe(true)
    expect(matchesClipboardQuery({ content: 'npm run build', type: 'code', sourceApplication: 'WindowsTerminal.exe' }, 'app:notepad')).toBe(false)
  })

  it('supports state and format qualifiers', () => {
    const richItem = { content: 'Release note', type: 'text', pinned: true, favorited: true, html: '<strong>Release note</strong>' }
    expect(matchesClipboardQuery(richItem, 'is:pinned is:favorite has:html has:rich')).toBe(true)
    expect(matchesClipboardQuery(richItem, 'has:rtf')).toBe(false)
    expect(matchesClipboardQuery({ content: 'image', type: 'image', imagePath: 'C:\\image.png' }, 'has:image')).toBe(true)
  })
})
describe('clipboard search index', () => {
  const items = [
    { id: 'one', content: '发布检查清单', type: 'text', tags: ['工作'], workspace: 'ClipMaster', sourceApplication: 'Code.exe' },
    { id: 'two', content: 'C:\\Docs\\report.pdf', type: 'file-list', files: ['C:\\Docs\\report.pdf'] },
    { id: 'three', content: 'hello world', type: 'text', favorited: true },
  ]

  it('returns operator and pinyin matches from the reusable index', () => {
    const index = createClipboardSearchIndex(items)
    expect([...searchClipboardIndex(index, 'fabu workspace:clip')]).toEqual(['one'])
    expect([...searchClipboardIndex(index, 'has:files')]).toEqual(['two'])
    expect([...searchClipboardIndex(index, 'is:favorite')]).toEqual(['three'])
  })

  it('reuses cached query result sets', () => {
    const index = createClipboardSearchIndex(items)
    const first = searchClipboardIndex(index, 'hello')
    const second = searchClipboardIndex(index, '  HELLO  ')
    expect(second).toBe(first)
  })
})
