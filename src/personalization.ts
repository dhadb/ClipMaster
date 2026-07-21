export const accentIds = ['theme', 'violet', 'teal', 'blue', 'rose', 'amber'] as const

export type AccentSetting = typeof accentIds[number]

export interface AccentPalette {
  primary: string
  light: string
  dark: string
}

export const accentPalettes: Record<Exclude<AccentSetting, 'theme'>, AccentPalette> = {
  violet: { primary: '#6d5dfc', light: '#9b8cff', dark: '#5144d8' },
  teal: { primary: '#0f9f85', light: '#54d7bd', dark: '#087664' },
  blue: { primary: '#2f80ed', light: '#70adff', dark: '#1f63bd' },
  rose: { primary: '#df4f76', light: '#f486a3', dark: '#b9365b' },
  amber: { primary: '#d98512', light: '#f2b84b', dark: '#aa6508' },
}

export function isAccentSetting(value: unknown): value is AccentSetting {
  return typeof value === 'string' && (accentIds as readonly string[]).includes(value)
}
