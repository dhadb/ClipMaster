export const themeIds = ['dark', 'light', 'graphite', 'forest', 'rose', 'ocean', 'high-contrast', 'auto'] as const

export type ThemeSetting = typeof themeIds[number]
export type ResolvedTheme = Exclude<ThemeSetting, 'auto'>

export function isThemeSetting(value: unknown): value is ThemeSetting {
  return typeof value === 'string' && (themeIds as readonly string[]).includes(value)
}

export function resolveTheme(theme: ThemeSetting, prefersDark: boolean): ResolvedTheme {
  if (theme === 'auto') return prefersDark ? 'dark' : 'light'
  return theme
}
