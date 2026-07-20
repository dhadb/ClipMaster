import { describe, expect, it } from 'vitest'
import { compareVersions } from './version'

describe('compareVersions', () => {
  it('compares stable semantic versions', () => {
    expect(compareVersions('v1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.1.9', '1.2.0')).toBe(-1)
  })

  it('orders prereleases before stable releases', () => {
    expect(compareVersions('1.2.0-beta.2', '1.2.0')).toBe(-1)
    expect(compareVersions('1.2.0-beta.10', '1.2.0-beta.2')).toBe(1)
  })
})
