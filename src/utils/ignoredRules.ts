import safeRegex from 'safe-regex2'

export const MAX_IGNORED_RULES = 30
export const MAX_IGNORED_RULE_LENGTH = 160
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
