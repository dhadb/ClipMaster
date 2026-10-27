import { getUtf8ByteLength, MAX_HISTORY_TEXT_BYTES } from './limits'

export interface RetentionItem {
  id: string
  content: string
  timestamp: number
  pinned: boolean
  favorited: boolean
  html?: string
  rtf?: string
  files?: string[]
}

export interface RetentionOptions {
  maxHistory: number
  autoDeleteDays: number
  verificationCodeTtlMinutes: number
  now?: number
  maxTextBytes?: number
}

function isSequentialDigits(value: string): boolean {
  let ascending = true
  let descending = true
  for (let i = 1; i < value.length; i += 1) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1)
    if (delta !== 1) ascending = false
    if (delta !== -1) descending = false
  }
  return ascending || descending
}

/**
 * 判断一段文本是否"像"短信/邮箱验证码。
 *
 * 旧实现是 `/^\d{4,8}$/`，把「2026」「1234」「8888」这类用户日常复制的
 * 年份/计数/占位数字全部当成验证码，套用很短的 verificationCodeTtlMinutes
 * 提前删除。这里只对**四位**数字做额外甄别（四位数最容易被误判，而 5-8 位
 * 数字在真实场景里几乎只有验证码一种来源），排除三类高频误判：
 *   - 1900-2099 的四位年份
 *   - 全部相同的数字（1111 / 8888）
 *   - 纯顺子/倒顺（1234 / 4321）
 */
export function isVerificationCode(text: string): boolean {
  const trimmed = text.trim()
  if (!/^\d{4,8}$/.test(trimmed)) return false
  if (trimmed.length === 4) {
    const value = Number(trimmed)
    if (value >= 1900 && value <= 2099) return false
    if (/^(\d)\1+$/.test(trimmed)) return false
    if (isSequentialDigits(trimmed)) return false
  }
  return true
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

  const budget = options.maxTextBytes ?? MAX_HISTORY_TEXT_BYTES
  const getItemBytes = (item: T) =>
    [
      item.content,
      item.html || '',
      item.rtf || '',
      ...(item.files || []),
    ].reduce((total, value) => total + getUtf8ByteLength(value), 0)

  const retained: T[] = []
  let retainedBytes = 0

  // 第一趟：收藏/置顶是用户的显式动作，不参与字节预算淘汰。
  // 宁可让总量短暂超出，也不能把用户亲手收藏的条目静默丢掉。
  for (const item of ordered) {
    if (!item.pinned && !item.favorited) continue
    retainedBytes += getItemBytes(item)
    retained.push(item)
  }

  // 第二趟：普通条目必须"保留最新"。一旦某条撑破预算就**停收**，
  // 不能像旧实现那样 continue 跳过它、继续把更旧的条目收回来——
  // 那会让早已过期的大段文本重新出现在历史里，破坏保留契约。
  for (const item of ordered) {
    if (item.pinned || item.favorited) continue
    const itemBytes = getItemBytes(item)
    if (retainedBytes + itemBytes > budget) break
    retainedBytes += itemBytes
    retained.push(item)
  }

  return retained
}
