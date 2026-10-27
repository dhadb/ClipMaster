import React from 'react'
import { Palette, Zap, Globe2, Sliders } from 'lucide-react'
import type { Settings as ClipboardSettings } from '../../store/clipboardStore'
import ThemePicker from '../ThemePicker'
import { accentIds, accentPalettes, type AccentSetting } from '../../personalization'
import { Card, Item, Slider, Divider } from '../ui/SettingControls'
import type { TFunc, UpdateFn } from './types'

interface Props {
  settings: ClipboardSettings
  update: UpdateFn
  t: TFunc
}

const AppearanceSection: React.FC<Props> = ({ settings, update, t }) => (
  <div className="space-y-4 slide-in-right">
    <Card title={t('settings.themeStyle')} icon={<Palette size={14} color="var(--color-primary-light)" />}>
      <ThemePicker value={settings.theme} onChange={theme => void update('theme', theme)} />
    </Card>

    <Card title={t('settings.accentColor')} icon={<Zap size={14} color="var(--color-primary-light)" />}>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{t('settings.accentColorDesc')}</p>
      <div className="flex flex-wrap gap-2">
        {accentIds.map(id => {
          const active = settings.accentColor === id
          const color = id === 'theme' ? 'var(--color-primary)' : accentPalettes[id].primary
          return (
            <button
              key={id}
              type="button"
              onClick={() => void update('accentColor', id as AccentSetting)}
              aria-pressed={active}
              className="flex h-9 w-9 items-center justify-center rounded-full interactive-chip"
              style={{ background: 'var(--bg-surface)', border: `1px solid ${active ? color : 'var(--border-card)'}`, boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${color} 20%, transparent)` : 'none' }}
              title={t(`settings.accent.${id}` as Parameters<typeof t>[0])}
            >
              <span className="h-5 w-5 rounded-full" style={{ background: color }} />
            </button>
          )
        })}
      </div>
    </Card>

    <Card title={t('settings.language')} icon={<Globe2 size={14} color="var(--color-success)" />}>
      <Item label={t('settings.language')} desc={t('settings.languageDesc')}>
        <div className="grid gap-1 rounded-lg p-1 min-w-[118px]" style={{ background: 'var(--bg-surface)' }}>
          {([
            { id: 'system', label: t('settings.languageSystem') },
            { id: 'zh-CN', label: t('settings.languageZh') },
            { id: 'en-US', label: t('settings.languageEn') },
          ] as Array<{ id: ClipboardSettings['language']; label: string }>).map(lang => (
            <button key={lang.id} type="button" onClick={() => void update('language', lang.id)}
              className="px-2 py-1 rounded-md text-[11px] interactive-chip text-left"
              style={{
                color: settings.language === lang.id ? 'white' : 'var(--text-tertiary)',
                background: settings.language === lang.id ? 'var(--color-primary)' : 'transparent',
              }}>
              {lang.label}
            </button>
          ))}
        </div>
      </Item>
    </Card>

    <Card title={t('settings.interface')} icon={<Sliders size={14} color="var(--color-primary-light)" />}>
      <Item label={t('settings.listDensity')} desc={t('settings.listDensityDesc')}>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-surface)' }}>
          {([
            { id: 'compact', label: t('settings.compact') },
            { id: 'normal', label: t('settings.normal') },
            { id: 'comfortable', label: t('settings.comfortable') },
          ] as Array<{ id: ClipboardSettings['listDensity']; label: string }>).map(d => (
            <button key={d.id} type="button" onClick={() => void update('listDensity', d.id)}
              className="px-2 py-1 rounded-md text-[11px] interactive-chip"
              style={{
                color: settings.listDensity === d.id ? 'white' : 'var(--text-tertiary)',
                background: settings.listDensity === d.id ? 'var(--color-primary)' : 'transparent',
              }}>
              {d.label}
            </button>
          ))}
        </div>
      </Item>
      <Divider />
      <Item label={t('settings.opacity')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{Math.round(settings.opacity * 100)}%</span></Item>
      <Slider value={settings.opacity} min={0.7} max={1} step={0.05} set={v => void update('opacity', v)} />
      <Divider />
      <Item label={t('settings.fontSize')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{settings.fontSize}px</span></Item>
      <Slider value={settings.fontSize} min={12} max={18} step={1} set={v => void update('fontSize', v)} unit="px" />
      <Divider />
      <Item label={t('settings.windowWidth')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{settings.windowWidth}px</span></Item>
      <Slider value={settings.windowWidth} min={350} max={600} step={10} set={v => void update('windowWidth', v)} unit="px" />
      <Divider />
      <Item label={t('settings.windowHeight')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{settings.windowHeight}px</span></Item>
      <Slider value={settings.windowHeight} min={400} max={800} step={10} set={v => void update('windowHeight', v)} unit="px" />
    </Card>
  </div>
)

export default AppearanceSection
