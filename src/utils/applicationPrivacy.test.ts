import { describe, expect, it } from 'vitest'
import { matchesBlockedApplication, normalizeBlockedApplications } from './applicationPrivacy'

describe('application privacy rules', () => {
  it('normalizes executable names and removes duplicates', () => {
    expect(normalizeBlockedApplications([' 1Password.exe ', 'C:\\Apps\\1password.EXE', 'KeePassXC'])).toEqual(['1password', 'keepassxc'])
  })

  it('matches exact application names without partial false positives', () => {
    expect(matchesBlockedApplication(['1password'], '1Password.exe')).toBe(true)
    expect(matchesBlockedApplication(['pass'], '1Password.exe')).toBe(false)
  })
})
