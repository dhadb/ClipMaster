import React from 'react'
import { Keyboard } from 'lucide-react'
import { Card, Item, Divider } from '../ui/SettingControls'
import type { TFunc, UpdateFn, HotkeySettingKey } from './types'

interface Props {
  hotkeyDrafts: Record<HotkeySettingKey, string>
  setHotkeyDrafts: React.Dispatch<React.SetStateAction<Record<HotkeySettingKey, string>>>
  update: UpdateFn
  hotkeyMessage: string
  t: TFunc
}

const HotkeysSection: React.FC<Props> = ({ hotkeyDrafts, setHotkeyDrafts, update, hotkeyMessage, t }) => (
  <div className="space-y-4 slide-in-right">
    <Card title={t('settings.globalHotkey')} icon={<Keyboard size={14} color="var(--color-primary-light)" />}>
      {([
        ['hotkey', 'settings.showHideWindow'],
        ['searchHotkey', 'settings.searchHotkey'],
        ['clearHotkey', 'settings.clearHotkey'],
      ] as Array<[HotkeySettingKey, 'settings.showHideWindow' | 'settings.searchHotkey' | 'settings.clearHotkey']>).map(([key, label]) => (
        <React.Fragment key={key}>
          <Item label={t(label)} desc={t('settings.hotkeyExample')}>
            <input
              value={hotkeyDrafts[key]}
              onChange={e => setHotkeyDrafts(previous => ({ ...previous, [key]: e.target.value }))}
              onBlur={() => void update(key, hotkeyDrafts[key])}
              onKeyDown={e => { if (e.key === 'Enter') void update(key, hotkeyDrafts[key]) }}
              className="px-2 py-1 rounded-md text-[12px] font-mono w-44"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }}
            />
          </Item>
          {key !== 'clearHotkey' && <Divider />}
        </React.Fragment>
      ))}
      {hotkeyMessage && (
        <p className="text-[11px] px-1" style={{ color: hotkeyMessage === t('settings.hotkeyUnavailable') || hotkeyMessage === t('settings.hotkeyFailed') ? 'var(--color-warning)' : 'var(--color-success)' }}>
          {hotkeyMessage}
        </p>
      )}
    </Card>
  </div>
)

export default HotkeysSection
