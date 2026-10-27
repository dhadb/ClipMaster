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

// 回归：变异体 M7b（把 #tag 分支改成 return true）曾让全部用例保持绿色。
// 以下用例专门锁死 #tag 限定符的正反语义：任何"标签过滤失效"的实现都必须变红。
describe('#tag qualifier semantics (regression: M7b)', () => {
  it('matches an exact stored tag', () => {
    expect(matchesClipboardQuery({ content: 'release checklist', type: 'text', tags: ['release'] }, '#release')).toBe(true)
  })

  it('rejects a tag query the item does not have', () => {
    expect(matchesClipboardQuery({ content: 'release checklist', type: 'text', tags: ['release'] }, '#other')).toBe(false)
    expect(matchesClipboardQuery({ content: 'release checklist', type: 'text', tags: [] }, '#release')).toBe(false)
  })

  it('matches tags case-insensitively in both directions', () => {
    expect(matchesClipboardQuery({ content: 'release checklist', type: 'text', tags: ['Release'] }, '#release')).toBe(true)
    expect(matchesClipboardQuery({ content: 'release checklist', type: 'text', tags: ['release'] }, '#RELEASE')).toBe(true)
  })

  it('does not match a tag query when neither tags nor content contain it', () => {
    // 裁决（C1）：实现 clipboard.ts 的 #tag 分支为
    //   content.includes(token) || tags.some(tag => tag.includes(tagQuery))
    // 即「标签命中」或「正文里的 #字面命中」都算，这是有意的产品行为
    // （见下方 hash-prefixed content 用例）。本条只锁定"两处都没有就不命中"。
    expect(matchesClipboardQuery({ content: 'release checklist', type: 'text' }, '#work')).toBe(false)
  })

  it('index-level: returns only the tagged item, exactly one hit', () => {
    // M7b 缺口核心：把 clipboard.ts:93 改成 `return true` 时，旧用例集仍全绿。
    // 本条在索引层锁定"命中 + 排除 + 只返 1 条"三件事：
    //   tagged 含 #foo 标签 → 必须命中
    //   untagged 无标签、other 只有别的标签 → 必须排除
    //   结果集大小必须恰好为 1（等价于"标签过滤没有失效"）
    const index = createClipboardSearchIndex([
      { id: 'tagged', content: '部署检查清单', type: 'text', tags: ['foo'] },
      { id: 'untagged', content: '部署检查清单', type: 'text' },
      { id: 'other-tag', content: '部署检查清单', type: 'text', tags: ['bar'] },
    ])
    const hits = [...searchClipboardIndex(index, '#foo')]
    expect(hits).toEqual(['tagged'])
    expect(hits).toHaveLength(1)
    expect(hits).not.toContain('untagged')
    expect(hits).not.toContain('other-tag')
  })

  it('index-level: a tag query never rescues items without that tag', () => {
    // 反向：让"标签过滤失效"的实现无法靠内容相似蒙混过关——两个条目的正文完全一致，
    // 唯一区别是 tags，因此命中与否只可能由 #tag 分支决定。
    const index = createClipboardSearchIndex([
      { id: 'match', content: 'identical body text', type: 'text', tags: ['foo'] },
      { id: 'miss', content: 'identical body text', type: 'text', tags: ['bar'] },
    ])
    expect([...searchClipboardIndex(index, '#foo')]).toEqual(['match'])
    expect([...searchClipboardIndex(index, '#bar')]).toEqual(['miss'])
    expect([...searchClipboardIndex(index, '#baz')]).toEqual([])
  })

  it('still finds hash-prefixed content literally (intentional, keep it)', () => {
    // 用户复制 '#FFAA00' 这类带 # 的字面内容后，用 '#ffaa' 搜得到，体验上是必须的。
    // 与上一条合起来才完整锁死 #tag 语义：只实现"标签过滤"或只实现"正文匹配"都会变红。
    expect(matchesClipboardQuery({ content: 'see #work in notes', type: 'text' }, '#work')).toBe(true)
  })
})
