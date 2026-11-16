import safeRegex from 'safe-regex2'

const MAX_IGNORED_RULES = 30
const MAX_IGNORED_RULE_LENGTH = 160
const regexPrefix = /^regex:/i

export type CompiledIgnoredRule =
  | { kind: 'keyword'; value: string }
  | { kind: 'regex'; value: RegExp }

function compileRegexRule(value: string): RegExp | null {
  const source = value.replace(regexPrefix, '').trim()
  if (!source || !safeRegex(source)) return null
  try {
    return new RegExp(source, 'i')
  } catch {
    return null
  }
}

export function normalizeIgnoredPatterns(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const value of input) {
    if (typeof value !== 'string') continue
    const rule = value.trim()
    if (!rule || rule.length > MAX_IGNORED_RULE_LENGTH) continue
    if (regexPrefix.test(rule) && !compileRegexRule(rule)) continue
    const key = rule.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(rule)
    if (normalized.length >= MAX_IGNORED_RULES) break
  }
  return normalized
}

export function compileIgnoredRules(input: unknown): CompiledIgnoredRule[] {
  return normalizeIgnoredPatterns(input).map(rule => {
    const expression = regexPrefix.test(rule) ? compileRegexRule(rule) : null
    return expression
      ? { kind: 'regex' as const, value: expression }
      : { kind: 'keyword' as const, value: rule.toLowerCase() }
  })
}

export function matchesIgnoredRules(rules: CompiledIgnoredRule[], text: string): boolean {
  if (!text.trim() || rules.length === 0) return false
  const lowerText = text.toLowerCase()
  return rules.some(rule => rule.kind === 'regex' ? rule.value.test(text) : lowerText.includes(rule.value))
}

/**
 * 用户 regex 忽略规则每 650ms 在主进程对剪贴板文本执行，输入长度不受单条上限约束，
 * 病态正则可能拖垮轮询。这里提供一个“带护栏”的匹配器工厂（P2 安全收尾）：
 * 1. subject 先截断到 subjectLimit 再匹配；
 * 2. 用注入的时钟给每条 regex 计时，单次超过 slowThresholdMs 记慢并回调；
 * 3. 同一条规则累计 maxSlowHits 次慢匹配后在本次运行期内跳过（自动禁用）。
 * 保持纯函数：时钟、阈值、慢回调全部可注入/观测，便于测试。
 */
export const DEFAULT_REGEX_SUBJECT_LIMIT = 10_000
export const DEFAULT_SLOW_RULE_THRESHOLD_MS = 50
export const MAX_SLOW_RULE_HITS = 3

export interface GuardedIgnoredRuleMatcherOptions {
  subjectLimit?: number
  slowThresholdMs?: number
  maxSlowHits?: number
  now?: () => number
  /** 每发生一次慢匹配回调一次；slowHits 为该规则当前的累计慢次数（1 起）。 */
  onSlowRule?: (ruleIndex: number, elapsedMs: number, slowHits: number) => void
}

export type GuardedIgnoredRuleMatcher = (text: string) => boolean

export function createGuardedIgnoredRuleMatcher(
  rules: CompiledIgnoredRule[],
  options: GuardedIgnoredRuleMatcherOptions = {},
): GuardedIgnoredRuleMatcher {
  const subjectLimit = options.subjectLimit ?? DEFAULT_REGEX_SUBJECT_LIMIT
  const slowThresholdMs = options.slowThresholdMs ?? DEFAULT_SLOW_RULE_THRESHOLD_MS
  const maxSlowHits = options.maxSlowHits ?? MAX_SLOW_RULE_HITS
  const now = options.now ?? (() => performance.now())
  const slowHits = new Array<number>(rules.length).fill(0)

  return text => {
    if (!text.trim() || rules.length === 0) return false
    const subject = text.length > subjectLimit ? text.slice(0, subjectLimit) : text
    const lowerSubject = subject.toLowerCase()
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index]
      if (rule.kind === 'keyword') {
        if (lowerSubject.includes(rule.value)) return true
        continue
      }
      // 已达慢匹配上限的规则在本次运行期内视为禁用，直接跳过。
      if (slowHits[index] >= maxSlowHits) continue
      const startedAt = now()
      const matched = rule.value.test(subject)
      const elapsedMs = now() - startedAt
      if (elapsedMs > slowThresholdMs) {
        slowHits[index] += 1
        options.onSlowRule?.(index, elapsedMs, slowHits[index])
        if (slowHits[index] >= maxSlowHits) continue
      }
      if (matched) return true
    }
    return false
  }
}
