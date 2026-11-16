import { describe, expect, it, vi } from 'vitest'
import {
  compileIgnoredRules,
  createGuardedIgnoredRuleMatcher,
  matchesIgnoredRules,
  normalizeIgnoredPatterns,
} from './ignoredRules'

describe('ignored clipboard rules', () => {
  it('treats ordinary rules as keywords and explicit regex rules as regular expressions', () => {
    const rules = compileIgnoredRules(['password manager', 'regex:^OTP-\\d{6}$'])
    expect(matchesIgnoredRules(rules, 'Copied from Password Manager')).toBe(true)
    expect(matchesIgnoredRules(rules, 'OTP-123456')).toBe(true)
    expect(matchesIgnoredRules(rules, 'OTP-123')).toBe(false)
  })

  it('rejects invalid and unsafe regular expressions', () => {
    expect(normalizeIgnoredPatterns(['regex:(a+)+$', 'regex:[', 'keep me'])).toEqual(['keep me'])
  })

  it('truncates the subject to the configured limit before matching', () => {
    const rules = compileIgnoredRules(['regex:tail$'])
    const matcher = createGuardedIgnoredRuleMatcher(rules, { subjectLimit: 8 })
    // 前 8 个字符是 'aaaaaaab'，'tail$' 只出现在被截断掉的部分。
    expect(matcher(`${'a'.repeat(8)}tail`)).toBe(false)
    expect(matcher('tail')).toBe(true)
  })

  it('counts slow regex executions and disables a rule after repeated slow hits', () => {
    const rules = compileIgnoredRules(['regex:needle'])
    let elapsed = 0
    const matcher = createGuardedIgnoredRuleMatcher(rules, {
      now: () => (elapsed += 60),
      slowThresholdMs: 50,
      maxSlowHits: 3,
    })
    expect(matcher('nothing here')).toBe(false)
    expect(matcher('nothing here')).toBe(false)
    expect(matcher('nothing here')).toBe(false)
    // 3 次慢匹配后规则被禁用：即使文本命中也不再生效。
    expect(matcher('has needle inside')).toBe(false)
  })

  it('reports every slow hit through the onSlowRule callback', () => {
    const rules = compileIgnoredRules(['regex:needle'])
    const onSlowRule = vi.fn()
    let elapsed = 0
    const matcher = createGuardedIgnoredRuleMatcher(rules, {
      now: () => (elapsed += 60),
      slowThresholdMs: 50,
      maxSlowHits: 3,
      onSlowRule,
    })
    matcher('nothing')
    matcher('nothing')
    expect(onSlowRule).toHaveBeenCalledTimes(2)
    expect(onSlowRule.mock.calls[0]).toEqual([0, 60, 1])
    expect(onSlowRule.mock.calls[1]).toEqual([0, 60, 2])
  })

  it('keeps keyword rules working when a sibling regex rule is disabled', () => {
    const rules = compileIgnoredRules(['secret', 'regex:needle'])
    let elapsed = 0
    const matcher = createGuardedIgnoredRuleMatcher(rules, {
      now: () => (elapsed += 60),
      slowThresholdMs: 50,
      maxSlowHits: 1,
    })
    // 第一轮 needle 记慢并被禁用，secret 关键字规则仍然生效。
    expect(matcher('nothing')).toBe(false)
    expect(matcher('top secret')).toBe(true)
    expect(matcher('has needle')).toBe(false)
  })
})
