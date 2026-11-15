export const accentIds = ['theme', 'violet', 'teal', 'blue', 'rose', 'amber'] as const

export type AccentSetting = typeof accentIds[number]

interface AccentPalette {
  primary: string
  light: string
}

export const accentPalettes: Record<Exclude<AccentSetting, 'theme'>, AccentPalette> = {
  violet: { primary: '#6d5dfc', light: '#9b8cff' },
  teal: { primary: '#0f9f85', light: '#54d7bd' },
  blue: { primary: '#2f80ed', light: '#70adff' },
  rose: { primary: '#df4f76', light: '#f486a3' },
  amber: { primary: '#d98512', light: '#f2b84b' },
}

export function isAccentSetting(value: unknown): value is AccentSetting {
  return typeof value === 'string' && (accentIds as readonly string[]).includes(value)
}
