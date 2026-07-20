export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 24

export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  const tags: string[] = []
  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value !== 'string') continue
    const tag = value.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length === MAX_TAGS) break
  }
  return tags
}

interface SearchableClipboardItem {
  content: string
  type: string
  tags?: string[]
}

export function matchesClipboardQuery(item: SearchableClipboardItem, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  const content = item.content.toLowerCase()
  const tags = normalizeTags(item.tags).map(tag => tag.toLowerCase())
  const searchable = `${content}\n${tags.join('\n')}`

  return query.split(/\s+/).every(token => {
    if (token.startsWith('#') && token.length > 1) {
      const tagQuery = token.slice(1)
      return content.includes(token) || tags.some(tag => tag.includes(tagQuery))
    }
    if (token.startsWith('type:') && token.length > 5) {
      return item.type.toLowerCase() === token.slice(5)
    }
    return searchable.includes(token)
  })
}
