import React, { useMemo, useState } from 'react'
import { AlertTriangle, DatabaseBackup, Lock, Scissors, ShieldAlert, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { useStorageHealth } from '../hooks/useStorageHealth'
import type { StorageHealth } from '../types/storageHealth'
import {
  buildStorageHealthIssues,
  getStorageHealthTone,
  summarizeLastError,
  type StorageHealthIssue,
  type StorageHealthTone,
} from '../utils/storageHealth'

/**
 * 顶部「落盘健康」提示条（P0-1 可见化）。
 *
 * 起因：备份恢复 / 主文件隔离 / 保存裁剪 / 加密降级此前只写 console，
 * 打包后的 GUI 进程没有 stdio，用户对"历史悄悄丢了"零感知。
 * 这里把 main.ts 的 StorageHealth 变成非模态提示：出现问题时常驻，点 X 可临时关闭。
 */

const TONE_COLOR: Record<StorageHealthTone, string> = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-primary-light)',
}

function IssueIcon({ id, color }: { id: StorageHealthIssue['id']; color: string }) {
  const props = { size: 12, color, className: 'flex-shrink-0 mt-[2px]', 'aria-hidden': true as const }
  if (id === 'loadFailed') return <AlertTriangle {...props} />
  if (id === 'recoveredFromBackup') return <DatabaseBackup {...props} />
  if (id === 'trimmed') return <Scissors {...props} />
  return <Lock {...props} />
}

interface Props {
  /** 显式注入状态（测试/Storybook）；不传则组件自行通过 IPC 拉取 */
  health?: StorageHealth | null
}

const StorageHealthBanner: React.FC<Props> = ({ health: injected }) => {
  const fetched = useStorageHealth(injected === undefined)
  const health = injected === undefined ? fetched : injected
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)

  const issues = useMemo(() => buildStorageHealthIssues(health), [health])
  const tone = getStorageHealthTone(issues)
  const lastError = summarizeLastError(health?.lastError, errorOpen ? 600 : 120)

  // 未读到状态、已关闭、一切正常 → 不占顶部空间
  if (!health || dismissed || !tone || issues.length === 0) return null

  const color = TONE_COLOR[tone]
  const showQuarantine = Boolean(health.corruptFilePath) && (health.loadFailed || health.recoveredFromBackup)

  return (
    <div
      data-testid="storage-health-banner"
      role="status"
      aria-live="polite"
      aria-label={t('storageHealth.title')}
      className="flex flex-col gap-1 px-3 py-2"
      style={{
        color: 'var(--text-secondary)',
        background: `color-mix(in srgb, ${color} 9%, var(--bg-app))`,
        borderBottom: `1px solid color-mix(in srgb, ${color} 22%, var(--border-divider))`,
      }}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert size={13} color={color} className="mt-[1px] flex-shrink-0" aria-hidden="true" />
        <ul className="min-w-0 flex-1 space-y-1">
          {issues.map(issue => (
            <li
              key={issue.id}
              data-testid={`storage-health-issue-${issue.id}`}
              className="flex items-start gap-1.5 text-[11px] leading-snug"
            >
              <IssueIcon id={issue.id} color={TONE_COLOR[issue.tone]} />
              <span className="min-w-0">
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t(issue.titleKey, issue.params)}
                </span>
                <span className="ml-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t(issue.detailKey, issue.params)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="action-btn"
          style={{ width: 20, height: 20 }}
          title={t('storageHealth.dismiss')}
          aria-label={t('storageHealth.dismiss')}
        >
          <X size={11} />
        </button>
      </div>

      {showQuarantine && (
        <p className="truncate px-1 text-[10px]" style={{ color: 'var(--text-ghost)' }} title={health.corruptFilePath ?? undefined}>
          {t('storageHealth.quarantined')}: <span className="font-mono">{health.corruptFilePath}</span>
        </p>
      )}

      {lastError && (
        <button
          type="button"
          onClick={() => setErrorOpen(value => !value)}
          aria-expanded={errorOpen}
          data-testid="storage-health-last-error"
          className="rounded px-1 text-left text-[10px] interactive-chip"
          style={{ color: 'var(--text-ghost)' }}
        >
          <span className="font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('storageHealth.lastError')}</span>
          {': '}
          <span className="font-mono">{lastError}</span>
          <span className="ml-1 underline" style={{ color: 'var(--text-tertiary)' }}>
            {errorOpen ? t('storageHealth.hideDetails') : t('storageHealth.details')}
          </span>
        </button>
      )}
    </div>
  )
}

export default React.memo(StorageHealthBanner)
