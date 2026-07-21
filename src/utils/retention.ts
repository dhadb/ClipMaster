import { getUtf8ByteLength, MAX_HISTORY_TEXT_BYTES } from './limits'

export interface RetentionItem {
  id: string
  content: string
  timestamp: number
  pinned: boolean
  favorited: boolean
}

export interface RetentionOptions {
  maxHistory: number
  autoDeleteDays: number
  verificationCodeTtlMinutes: number
  now?: number
  maxTextBytes?: number
}

export function isVerificationCode(text: string): boolean {
  return /^\d{4,8}$/.test(text.trim())
}

export function retainHistoryItems<T extends RetentionItem>(items: T[], options: RetentionOptions): T[] {
  const now = options.now ?? Date.now()
  const normalMaxAge = options.autoDeleteDays > 0 ? options.autoDeleteDays * 24 * 60 * 60 * 1000 : Infinity
  const codeMaxAge = options.verificationCodeTtlMinutes > 0 ? options.verificationCodeTtlMinutes * 60 * 1000 : Infinity
  const retainedByAge = items.filter(item => {
    if (item.pinned || item.favorited) return true
    const age = now - item.timestamp
    return age <= (isVerificationCode(item.content) ? codeMaxAge : normalMaxAge)
  })

  const protectedItems = retainedByAge.filter(item => item.pinned || item.favorited)
  const normalItems = retainedByAge.filter(item => !item.pinned && !item.favorited)
  const maxNormal = Math.max(0, options.maxHistory - protectedItems.length)
  const ordered = [...protectedItems, ...normalItems.slice(0, maxNormal)].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    if (left.favorited !== right.favorited) return left.favorited ? -1 : 1
    return right.timestamp - left.timestamp
  })

  const retained: T[] = []
  let retainedBytes = 0
  for (const item of ordered) {
    const itemBytes = getUtf8ByteLength(item.content)
    if (retainedBytes + itemBytes > (options.maxTextBytes ?? MAX_HISTORY_TEXT_BYTES)) continue
    retainedBytes += itemBytes
    retained.push(item)
  }
  return retained
}
