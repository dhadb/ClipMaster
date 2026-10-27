import React from 'react'
import { Database, Image as ImageIcon } from 'lucide-react'
import { Card, Item, Divider } from '../ui/SettingControls'
import type { TFunc, DataSecurityStatus } from './types'

interface Props {
  historyLen: number
  favoriteCount: number
  imageCount: number
  securityStatus: DataSecurityStatus
  cleanupCache: () => Promise<void>
  cacheMessage: string
  t: TFunc
}

const StorageSection: React.FC<Props> = ({ historyLen, favoriteCount, imageCount, securityStatus, cleanupCache, cacheMessage, t }) => (
  <div className="space-y-4 slide-in-right">
    <Card title={t('settings.storageOverview')} icon={<Database size={14} color="var(--color-primary-light)" />}>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
          <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{historyLen}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.currentRecords')}</p>
        </div>
        <div className="p-4 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--color-success) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 8%, transparent)' }}>
          <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {favoriteCount}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.favoriteCount')}</p>
        </div>
      </div>
    </Card>

    <Card title={t('settings.imageCache')} icon={<ImageIcon size={14} color="var(--color-success)" />}>
      <Item label={t('settings.imageRecords')} desc={t('settings.imageRecordsDesc')}>
        <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {t('settings.countUnit', { count: imageCount })}
        </span>
      </Item>
      <Divider />
      <Item label={t('settings.dataEncryption')} desc={t('settings.dataEncryptionDesc')}>
        <span className="rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: securityStatus?.active ? 'var(--color-success)' : 'var(--color-warning)', background: securityStatus?.active ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-warning) 12%, transparent)' }}>
          {securityStatus?.active ? t('settings.encryptionEnabled') : securityStatus?.migrating ? t('settings.encryptionMigrating') : t('settings.encryptionUnavailable')}
        </span>
      </Item>
      <Divider />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>
          {t('settings.cleanupDesc')}
        </p>
        <button type="button" onClick={cleanupCache} className="px-3 py-1.5 rounded-lg text-[11px] interactive-chip flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }}>
          {t('settings.cleanup')}
        </button>
      </div>
      {cacheMessage && <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{cacheMessage}</p>}
    </Card>
  </div>
)

export default StorageSection
