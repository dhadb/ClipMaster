import React from 'react'
import { AlertTriangle, DatabaseBackup, Lock, Scissors, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, Divider } from '../ui/SettingControls'
import { buildStorageHealthIssues, summarizeLastError, type StorageHealthIssue } from '../../utils/storageHealth'
import type { StorageHealth } from '../../types/storageHealth'
import type { TFunc } from './types'

/**
 * 设置 → 存储 →「数据写入健康」卡片。
 *
 * 与顶部提示条（StorageHealthBanner）同源同数据：提示条负责"当下必须看见"，
 * 本卡片负责"归档可查"——包括被隔离的文件路径与完整错误文本。
 */

const ISSUE_ICON: Record<StorageHealthIssue['id'], LucideIcon> = {
  loadFailed: AlertTriangle,
  recoveredFromBackup: DatabaseBackup,
  trimmed: Scissors,
  encryption: Lock,
}

interface Props {
  health: StorageHealth | null
  t: TFunc
}

const StorageHealthSection: React.FC<Props> = ({ health, t }) => {
  const issues = buildStorageHealthIssues(health)
  const lastError = summarizeLastError(health?.lastError, 600)

  return (
    <Card title={t('storageHealth.sectionTitle')} icon={<DatabaseBackup size={14} color="var(--color-primary-light)" />}>
      {!health && (
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('storageHealth.loading')}</p>
      )}

      {health && issues.length === 0 && (
        <div className="flex items-start gap-2">
          <ShieldCheck size={14} color="var(--color-success)" className="mt-[2px] flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('storageHealth.ok')}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>{t('storageHealth.okDesc')}</p>
          </div>
        </div>
      )}

      {health && issues.length > 0 && (
        <ul className="space-y-2">
          {issues.map(issue => {
            const Icon = ISSUE_ICON[issue.id]
            return (
              <li key={issue.id} data-testid={`settings-storage-health-${issue.id}`} className="flex items-start gap-2">
                <Icon
                  size={13}
                  className="mt-[2px] flex-shrink-0"
                  color={issue.tone === 'danger' ? 'var(--color-danger)' : issue.tone === 'warning' ? 'var(--color-warning)' : 'var(--color-primary-light)'}
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{t(issue.titleKey, issue.params)}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{t(issue.detailKey, issue.params)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {health?.corruptFilePath && (health.loadFailed || health.recoveredFromBackup) && (
        <>
          <Divider />
          <div>
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('storageHealth.quarantined')}</p>
            <p className="break-all font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>{health.corruptFilePath}</p>
          </div>
        </>
      )}

      {lastError && (
        <>
          <Divider />
          <div>
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('storageHealth.lastError')}</p>
            <p className="break-words font-mono text-[10px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{lastError}</p>
          </div>
        </>
      )}
    </Card>
  )
}

export default StorageHealthSection
