import { describe, expect, it } from 'vitest'
import { isThemeSetting, resolveTheme } from './theme'

describe('theme settings', () => {
  it('recognizes supported themes', () => {
    expect(isThemeSetting('forest')).toBe(true)
    expect(isThemeSetting('unknown')).toBe(false)
  })

  it('resolves auto without changing explicit themes', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('ocean', false)).toBe('ocean')
  })
})
