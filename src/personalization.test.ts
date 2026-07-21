import { describe, expect, it } from 'vitest'
import { accentPalettes, isAccentSetting } from './personalization'

describe('personalization', () => {
  it('accepts known accent settings only', () => {
    expect(isAccentSetting('theme')).toBe(true)
    expect(isAccentSetting('teal')).toBe(true)
    expect(isAccentSetting('#ff00ff')).toBe(false)
  })

  it('provides complete color palettes', () => {
    expect(accentPalettes.blue).toEqual({
      primary: '#2f80ed',
      light: '#70adff',
      dark: '#1f63bd',
    })
  })
})
