import { match as matchPinyin } from 'pinyin-pro'

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
  pinned?: boolean
  favorited?: boolean
  imagePath?: string
  html?: string
  rtf?: string
  sourceApplication?: string
  tags?: string[]
  workspace?: string
}

function getSearchTokens(rawQuery: string) {
  return rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function getSubsequenceIndexes(text: string, token: string): number[] | null {
  let cursor = 0
  const indexes: number[] = []
  for (const character of token) {
    const index = text.indexOf(character, cursor)
    if (index === -1) return null
    indexes.push(index)
    cursor = index + 1
  }
  return indexes
}

function matchesFuzzyToken(text: string, token: string) {
  if (text.includes(token)) return true
  if (getSubsequenceIndexes(text, token)) return true

  // pinyin-pro runs locally in the renderer; no clipboard content is sent away.
  if (/^[a-z]+$/i.test(token) && /[\u3400-\u9fff]/.test(text)) {
    return matchPinyin(text, token, { insensitive: true, precision: 'any' }) !== null
  }
  return false
}

export function matchesClipboardQuery(item: SearchableClipboardItem, rawQuery: string): boolean {
  const tokens = getSearchTokens(rawQuery)
  if (tokens.length === 0) return true

  const content = item.content.toLowerCase()
  const tags = normalizeTags(item.tags).map(tag => tag.toLowerCase())
  const workspace = item.workspace?.toLowerCase() || ''
  const sourceApplication = item.sourceApplication?.toLowerCase() || ''
  const searchable = `${content}\n${tags.join('\n')}\n${workspace}\n${sourceApplication}`

  return tokens.every(token => {
    if (token.startsWith('#') && token.length > 1) {
      const tagQuery = token.slice(1)
      return content.includes(token) || tags.some(tag => tag.includes(tagQuery))
    }
    if (token.startsWith('type:') && token.length > 5) {
      return item.type.toLowerCase() === token.slice(5)
    }
    if (token.startsWith('workspace:') && token.length > 10) {
      return matchesFuzzyToken(workspace, token.slice(10))
    }
    if (token.startsWith('app:') && token.length > 4) {
      return matchesFuzzyToken(sourceApplication, token.slice(4))
    }
    if (token === 'is:pinned') return item.pinned === true
    if (token === 'is:favorite' || token === 'is:favorited') return item.favorited === true
    if (token === 'has:image') return Boolean(item.imagePath)
    if (token === 'has:html') return Boolean(item.html)
    if (token === 'has:rtf') return Boolean(item.rtf)
    if (token === 'has:rich') return Boolean(item.html || item.rtf)
    return matchesFuzzyToken(searchable, token)
  })
}

export function getClipboardHighlightIndexes(content: string, rawQuery: string): number[] {
  const normalized = content.toLowerCase()
  const indexes = new Set<number>()

  for (const token of getSearchTokens(rawQuery)) {
    if (token.startsWith('#') || token.startsWith('type:') || token.startsWith('workspace:') || token.startsWith('app:') || token.startsWith('is:') || token.startsWith('has:')) continue
    const exactIndex = normalized.indexOf(token)
    if (exactIndex >= 0) {
      for (let index = exactIndex; index < exactIndex + token.length; index += 1) indexes.add(index)
      continue
    }
    const fuzzyIndexes = getSubsequenceIndexes(normalized, token)
    if (fuzzyIndexes) {
      fuzzyIndexes.forEach(index => indexes.add(index))
      continue
    }
    if (/^[a-z]+$/i.test(token) && /[\u3400-\u9fff]/.test(content)) {
      matchPinyin(content, token, { insensitive: true, precision: 'any' })?.forEach(index => indexes.add(index))
    }
  }

  return [...indexes].sort((a, b) => a - b)
}
