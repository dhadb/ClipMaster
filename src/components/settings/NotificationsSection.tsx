import React from 'react'
import { Bell } from 'lucide-react'
import type { Settings as ClipboardSettings } from '../../store/clipboardStore'
import { Card, Item, Toggle, Divider } from '../ui/SettingControls'
import type { TFunc, UpdateFn } from './types'

interface Props {
  settings: ClipboardSettings
  update: UpdateFn
  t: TFunc
}

const NotificationsSection: React.FC<Props> = ({ settings, update, t }) => (
  <div className="space-y-4 slide-in-right">
    <Card title={t('settings.notification')} icon={<Bell size={14} color="var(--color-primary-light)" />}>
      <Item label={t('settings.copySound')} desc={t('settings.copySoundDesc')}><Toggle on={settings.soundEnabled} set={v => void update('soundEnabled', v)} /></Item>
      <Divider />
      <Item label={t('settings.autoCheckUpdates')} desc={t('settings.autoCheckUpdatesDesc')}><Toggle on={settings.autoCheckUpdates} set={v => void update('autoCheckUpdates', v)} /></Item>
    </Card>
  </div>
)

export default NotificationsSection
