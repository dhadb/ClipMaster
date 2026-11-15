import { getUtf8ByteLength } from './limits'

/** 裁剪时只关心体积与保护标记，其余字段原样保留。 */
export interface BudgetableHistoryItem {
  content: string
  html?: string
  rtf?: string
  files?: string[]
  pinned?: boolean
  favorited?: boolean
  timestamp: number
}

interface PersistBudgetResult<T> {
  items: T[]
  /** 被移除的条目数 */
  dropped: number
  /** 裁剪后重新测量的体积 */
  bytes: number
}

/** 单条目可释放的体积估算；+160 为 JSON 结构（键名、引号、逗号、时间戳等）的经验开销。 */
export function getHistoryItemByteSize(item: BudgetableHistoryItem): number {
  return getUtf8ByteLength([item.content, item.html || '', item.rtf || '', ...(item.files || [])].join('')) + 160
}

/**
 * 把历史裁剪到预算内，优先丢弃「最旧且未受保护」的条目。
 *
 * 为什么需要它：持久化侧只在**读取**时用上限拒收文件，写侧不校验。
 * 一旦写出超限文件，下次启动读不回来 → 回退备份 → 本轮改动丢失 → 之后每次保存都超限。
 * 因此在写之前裁剪，比在写完/读失败后回滚便宜得多。
 *
 * 约束：置顶（pinned）与收藏（favorited）的条目永不丢弃 —— 用户明确表达过保留意图。
 * 如果受保护条目本身就把预算占满，这里只返回 dropped=0 与超限的 bytes，
 * 由调用方决定是否报错跳过本次写入，不要在这里静默截断用户珍视的数据。
 *
 * 不修改入参；`measure` 由调用方提供整体序列化后的字节数，避免与具体数据结构耦合。
 */
export function fitHistoryToBudget<T extends BudgetableHistoryItem>(
  history: readonly T[],
  budgetBytes: number,
  measure: (items: readonly T[]) => number,
): PersistBudgetResult<T> {
  const items = [...history]
  const total = measure(items)
  if (total <= budgetBytes) return { items, dropped: 0, bytes: total }

  // 最坏情况每次只丢 1 条，轮数上限防止病态输入（例如空 content 的海量条目）造成长时间循环
  const maxRounds = Math.min(items.length, 64)
  let dropped = 0
  for (let round = 0; round < maxRounds; round += 1) {
    const current = measure(items)
    if (current <= budgetBytes) return { items, dropped, bytes: current }

    let oldestIndex = -1
    for (let index = 0; index < items.length; index += 1) {
      const candidate = items[index]
      if (candidate.pinned || candidate.favorited) continue
      if (oldestIndex === -1 || candidate.timestamp < items[oldestIndex].timestamp) oldestIndex = index
    }
    if (oldestIndex === -1) break // 全是受保护条目：交给调用方处理

    items.splice(oldestIndex, 1)
    dropped += 1
  }

  return { items, dropped, bytes: measure(items) }
}
