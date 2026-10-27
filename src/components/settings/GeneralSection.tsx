import React from 'react'
import { Zap, Shield, Database } from 'lucide-react'
import type { Settings as ClipboardSettings } from '../../store/clipboardStore'
import { Card, Item, Slider, Toggle, Divider } from '../ui/SettingControls'
import type { TFunc, UpdateFn, SensitiveRuleUpdater } from './types'

interface Props {
  settings: ClipboardSettings
  update: UpdateFn
  updateSensitiveRule: SensitiveRuleUpdater
  ignoredDraft: string
  setIgnoredDraft: (v: string) => void
  saveIgnoredPatterns: () => void
  blockedApplicationsDraft: string
  setBlockedApplicationsDraft: (v: string) => void
  saveBlockedApplications: () => void
  t: TFunc
}

const GeneralSection: React.FC<Props> = ({
  settings,
  update,
  updateSensitiveRule,
  ignoredDraft,
  setIgnoredDraft,
  saveIgnoredPatterns,
  blockedApplicationsDraft,
  setBlockedApplicationsDraft,
  saveBlockedApplications,
  t,
}) => (
  <div className="space-y-4 slide-in-right">
    <Card title={t('settings.feature')} icon={<Zap size={14} color="var(--color-primary-light)" />}>
      <Item label={t('settings.autoStart')} desc={t('settings.autoStartDesc')}><Toggle on={settings.autoStart} set={v => void update('autoStart', v)} /></Item>
      <Divider />
      <Item label={t('settings.minimizeToTray')} desc={t('settings.minimizeToTrayDesc')}><Toggle on={settings.minimizeToTray} set={v => void update('minimizeToTray', v)} /></Item>
      <Divider />
      <Item label={t('settings.copyOnSelect')} desc={t('settings.copyOnSelectDesc')}><Toggle on={settings.copyOnSelect} set={v => void update('copyOnSelect', v)} /></Item>
      <Divider />
      <Item label={t('settings.hideAfterCopy')} desc={t('settings.hideAfterCopyDesc')}><Toggle on={settings.hideAfterCopy} set={v => void update('hideAfterCopy', v)} /></Item>
      <Divider />
      <Item label={t('settings.quickPaste')} desc={t('settings.quickPasteDesc')}><Toggle on={settings.quickPaste} set={v => void update('quickPaste', v)} /></Item>
      <Divider />
      <Item label={t('settings.ignoreSensitive')} desc={t('settings.ignoreSensitiveDesc')}><Toggle on={settings.ignoreSensitive} set={v => void update('ignoreSensitive', v)} /></Item>
      <Divider />
      <Item label={t('settings.recordImages')} desc={t('settings.recordImagesDesc')}><Toggle on={settings.recordImages} set={v => void update('recordImages', v)} /></Item>
      <Divider />
      <Item label={t('settings.showPreview')} desc={t('settings.showPreviewDesc')}><Toggle on={settings.showPreview} set={v => void update('showPreview', v)} /></Item>
    </Card>

    <Card title={t('settings.ignoredRules')} icon={<Shield size={14} color="var(--color-success)" />}>
      <div className="space-y-2">
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>
          {t('settings.ignoredRulesDesc')}
        </p>
        <textarea
          value={ignoredDraft}
          onChange={e => setIgnoredDraft(e.target.value)}
          onBlur={saveIgnoredPatterns}
          placeholder={t('settings.ignoredPlaceholder')}
          className="w-full h-24 px-3 py-2 rounded-lg text-[12px] font-mono resize-none outline-none"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }}
        />
        <button onClick={saveIgnoredPatterns} className="px-3 py-1.5 rounded-lg text-[11px] interactive-chip"
          style={{ background: 'var(--color-primary)', color: 'white' }}>
          {t('settings.saveIgnored')}
        </button>
      </div>
    </Card>

    <Card title={t('settings.applicationPrivacy')} icon={<Shield size={14} color="var(--color-warning)" />}>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>{t('settings.applicationPrivacyDesc')}</p>
      <textarea
        value={blockedApplicationsDraft}
        onChange={event => setBlockedApplicationsDraft(event.target.value)}
        onBlur={saveBlockedApplications}
        placeholder={t('settings.applicationPrivacyPlaceholder')}
        className="h-20 w-full resize-none rounded-lg px-3 py-2 text-[12px] font-mono outline-none"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }}
      />
      <button onClick={saveBlockedApplications} className="rounded-lg px-3 py-1.5 text-[11px] interactive-chip" style={{ background: 'var(--color-primary)', color: 'white' }}>
        {t('settings.saveApplications')}
      </button>
    </Card>

    <Card title={t('settings.sensitiveRuleTypes')} icon={<Shield size={14} color="var(--color-success)" />}>
      <Item label={t('settings.protectCredentials')} desc={t('settings.protectCredentialsDesc')}><Toggle on={settings.sensitiveRules.credentials} set={value => updateSensitiveRule('credentials', value)} /></Item>
      <Divider />
      <Item label={t('settings.protectPaymentCards')} desc={t('settings.protectPaymentCardsDesc')}><Toggle on={settings.sensitiveRules.paymentCards} set={value => updateSensitiveRule('paymentCards', value)} /></Item>
      <Divider />
      <Item label={t('settings.protectIdentityNumbers')} desc={t('settings.protectIdentityNumbersDesc')}><Toggle on={settings.sensitiveRules.identityNumbers} set={value => updateSensitiveRule('identityNumbers', value)} /></Item>
    </Card>

    <Card title={t('settings.history')} icon={<Database size={14} color="var(--color-primary-light)" />}>
      <Item label={t('settings.maxHistory')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t('settings.countUnit', { count: settings.maxHistory })}</span></Item>
      <Slider value={settings.maxHistory} min={50} max={5000} step={50} set={v => void update('maxHistory', v)} />
      <Divider />
      <Item label={t('settings.retentionDays')} desc={t('settings.zeroNever')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t('settings.daysUnit', { count: settings.autoDeleteDays })}</span></Item>
      <Slider value={settings.autoDeleteDays} min={0} max={365} step={1} set={v => void update('autoDeleteDays', v)} unit={t('settings.daysUnit', { count: '' }).trim()} />
      <Divider />
      <Item label={t('settings.verificationTtl')} desc={t('settings.zeroNever')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t('settings.minutesUnit', { count: settings.verificationCodeTtlMinutes })}</span></Item>
      <Slider value={settings.verificationCodeTtlMinutes} min={0} max={1440} step={5} set={v => void update('verificationCodeTtlMinutes', v)} unit={t('settings.minutesUnit', { count: '' }).trim()} />
    </Card>
  </div>
)

export default GeneralSection
