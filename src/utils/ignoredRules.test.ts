import { describe, expect, it } from 'vitest'
import { compileIgnoredRules, matchesIgnoredRules, normalizeIgnoredPatterns } from './ignoredRules'

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
})
