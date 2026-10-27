import React from 'react'
import { Check, Monitor } from 'lucide-react'
import type { ThemeSetting } from '../theme'
import { useI18n } from '../i18n'

interface Props {
  value: ThemeSetting
  onChange: (theme: ThemeSetting) => void
}

const options: Array<{ id: ThemeSetting; labelKey: Parameters<ReturnType<typeof useI18n>['t']>[0]; light?: boolean }> = [
  { id: 'dark', labelKey: 'settings.dark' },
  { id: 'light', labelKey: 'settings.light', light: true },
  { id: 'graphite', labelKey: 'settings.graphite' },
  { id: 'forest', labelKey: 'settings.forest' },
  { id: 'rose', labelKey: 'settings.rose' },
  { id: 'ocean', labelKey: 'settings.ocean' },
  { id: 'high-contrast', labelKey: 'settings.highContrast' },
  { id: 'auto', labelKey: 'settings.autoTheme' },
]

const ThemePicker: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map(option => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className="relative flex items-center gap-2.5 rounded-lg p-2.5 text-left interactive-chip"
            style={{
              color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: active ? 'color-mix(in srgb, var(--color-primary) 10%, var(--bg-surface))' : 'var(--bg-surface)',
              border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 38%, var(--border-card))' : 'var(--border-card)'}`,
            }}
          >
            <div className="flex h-9 w-12 flex-shrink-0 overflow-hidden rounded-md" style={{ border: '1px solid var(--border-card)' }}>
              <span className={`theme-swatch theme-swatch--${option.id}`} aria-hidden="true">
                <span /><span /><span />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {option.id === 'auto' && <Monitor size={11} />}
                <span className="truncate text-[11px] font-medium">{t(option.labelKey)}</span>
              </div>
            </div>
            {active && <Check size={13} color="var(--color-primary-light)" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}

export default React.memo(ThemePicker)
