import React, { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { Settings, Keyboard, Palette, Database, Bell, Sliders, Info, Zap, Heart, Shield, Image as ImageIcon, Globe2, HelpCircle, RefreshCw } from 'lucide-react'
import { useClipboardStore, type Settings as ClipboardSettings } from '../store/clipboardStore'
import { useI18n } from '../i18n'
import ThemePicker from './ThemePicker'
import UpdateStatus from './UpdateStatus'
import { accentIds, accentPalettes, type AccentSetting } from '../personalization'

const appIconUrl = './icon.png'
type HotkeySettingKey = 'hotkey' | 'searchHotkey' | 'clearHotkey'

const SettingsPanel: React.FC = memo(() => {
  const settings = useClipboardStore(s => s.settings)
  const updateSettings = useClipboardStore(s => s.updateSettings)
  const history = useClipboardStore(s => s.history)
  const historyLen = useClipboardStore(s => s.history.length)
  const appVersion = useClipboardStore(s => s.appVersion)
  const { t } = useI18n()
  const [section, setSection] = useState('general')
  const [hotkeyDrafts, setHotkeyDrafts] = useState<Record<HotkeySettingKey, string>>({ hotkey: settings.hotkey, searchHotkey: settings.searchHotkey, clearHotkey: settings.clearHotkey })
  const [hotkeyMessage, setHotkeyMessage] = useState('')
  const [ignoredDraft, setIgnoredDraft] = useState(settings.ignoredPatterns.join('\n'))
  const [cacheMessage, setCacheMessage] = useState('')
  const [securityStatus, setSecurityStatus] = useState<{ available: boolean; active: boolean; migrating: boolean } | null>(null)

  const favoriteCount = useMemo(() => history.filter(item => item.favorited).length, [history])
  const imageCount = useMemo(() => history.filter(item => item.type === 'image').length, [history])

  useEffect(() => {
    setHotkeyDrafts({ hotkey: settings.hotkey, searchHotkey: settings.searchHotkey, clearHotkey: settings.clearHotkey })
    setIgnoredDraft(settings.ignoredPatterns.join('\n'))
  }, [settings.hotkey, settings.searchHotkey, settings.clearHotkey, settings.ignoredPatterns])

  useEffect(() => {
    window.electronAPI?.getDataSecurityStatus().then(setSecurityStatus).catch(() => setSecurityStatus(null))
  }, [])

  const update = useCallback(async <K extends keyof typeof settings>(key: K, val: typeof settings[K]) => {
    try {
      const applied = await updateSettings({ [key]: val } as Partial<typeof settings>)
      if (applied) {
        if (key === 'hotkey' || key === 'searchHotkey' || key === 'clearHotkey') {
          const requested = String(val)
          if (applied[key] !== requested) {
            setHotkeyDrafts(previous => ({ ...previous, [key]: String(applied[key]) }))
            setHotkeyMessage(t('settings.hotkeyUnavailable'))
          } else {
            setHotkeyMessage(t('settings.hotkeyUpdated'))
          }
        }
      }
    } catch (err) {
      console.error('updateSettings failed:', err)
      if (key === 'hotkey' || key === 'searchHotkey' || key === 'clearHotkey') setHotkeyMessage(t('settings.hotkeyFailed'))
    }
  }, [t, updateSettings])

  const saveIgnoredPatterns = useCallback(() => {
    const patterns = ignoredDraft.split(/\r?\n/).map(v => v.trim()).filter(Boolean)
    update('ignoredPatterns', patterns)
  }, [ignoredDraft, update])

  const cleanupCache = useCallback(async () => {
    try {
      const result = await window.electronAPI?.cleanupImageCache()
      if (!result) return
      const mb = result.bytes / 1024 / 1024
      setCacheMessage(t('settings.cleanupDone', { count: result.deleted, size: mb.toFixed(2) }))
    } catch (err) {
      console.error('cleanupImageCache failed:', err)
      setCacheMessage(t('settings.cleanupFailed'))
    }
  }, [t])

  const sections = [
    { id: 'general', label: t('settings.general'), Icon: Settings },
    { id: 'appearance', label: t('settings.appearance'), Icon: Palette },
    { id: 'hotkeys', label: t('settings.hotkeys'), Icon: Keyboard },
    { id: 'storage', label: t('settings.storage'), Icon: Database },
    { id: 'notifications', label: t('settings.notifications'), Icon: Bell },
    { id: 'help', label: t('settings.help'), Icon: HelpCircle },
    { id: 'about', label: t('settings.about'), Icon: Info },
  ]

  const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void }> = ({ on, set }) => (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => set(!on)} />
  )

  const Slider: React.FC<{ value: number; min: number; max: number; step: number; set: (v: number) => void; unit?: string }> = ({ value, min, max, step, set, unit }) => (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)} className="flex-1" />
      <span className="text-[13px] w-14 text-right font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>{value}{unit || ''}</span>
    </div>
  )

  const Item: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
    <div className="setting-item">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {desc && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  )

  const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="glass-card rounded-lg p-5 space-y-4">
      <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        {icon}{title}
      </h3>
      {children}
    </div>
  )

  const renderContent = () => {
    switch (section) {
      case 'general':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title={t('settings.feature')} icon={<Zap size={14} color="var(--color-primary-light)" />}>
              <Item label={t('settings.autoStart')} desc={t('settings.autoStartDesc')}><Toggle on={settings.autoStart} set={v => update('autoStart', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.minimizeToTray')} desc={t('settings.minimizeToTrayDesc')}><Toggle on={settings.minimizeToTray} set={v => update('minimizeToTray', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.copyOnSelect')} desc={t('settings.copyOnSelectDesc')}><Toggle on={settings.copyOnSelect} set={v => update('copyOnSelect', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.hideAfterCopy')} desc={t('settings.hideAfterCopyDesc')}><Toggle on={settings.hideAfterCopy} set={v => update('hideAfterCopy', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.ignoreSensitive')} desc={t('settings.ignoreSensitiveDesc')}><Toggle on={settings.ignoreSensitive} set={v => update('ignoreSensitive', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.recordImages')} desc={t('settings.recordImagesDesc')}><Toggle on={settings.recordImages} set={v => update('recordImages', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.showPreview')} desc={t('settings.showPreviewDesc')}><Toggle on={settings.showPreview} set={v => update('showPreview', v)} /></Item>
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
            <Card title={t('settings.history')} icon={<Database size={14} color="var(--color-primary-light)" />}>
              <Item label={t('settings.maxHistory')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t('settings.countUnit', { count: settings.maxHistory })}</span></Item>
              <Slider value={settings.maxHistory} min={50} max={500} step={10} set={v => update('maxHistory', v)} />
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.retentionDays')} desc={t('settings.zeroNever')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t('settings.daysUnit', { count: settings.autoDeleteDays })}</span></Item>
              <Slider value={settings.autoDeleteDays} min={0} max={365} step={1} set={v => update('autoDeleteDays', v)} unit={t('settings.daysUnit', { count: '' }).trim()} />
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.verificationTtl')} desc={t('settings.zeroNever')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t('settings.minutesUnit', { count: settings.verificationCodeTtlMinutes })}</span></Item>
              <Slider value={settings.verificationCodeTtlMinutes} min={0} max={1440} step={5} set={v => update('verificationCodeTtlMinutes', v)} unit={t('settings.minutesUnit', { count: '' }).trim()} />
            </Card>
          </div>
        )
      case 'appearance':
        return (
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
                    <button key={id} onClick={() => void update('accentColor', id as AccentSetting)} aria-pressed={active} className="flex h-9 w-9 items-center justify-center rounded-full interactive-chip" style={{ background: 'var(--bg-surface)', border: `1px solid ${active ? color : 'var(--border-card)'}`, boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${color} 20%, transparent)` : 'none' }} title={t(`settings.accent.${id}` as Parameters<typeof t>[0])}>
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
                    <button key={lang.id} onClick={() => update('language', lang.id)}
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
                    <button key={d.id} onClick={() => update('listDensity', d.id)}
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
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.opacity')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{Math.round(settings.opacity * 100)}%</span></Item>
              <Slider value={settings.opacity} min={0.7} max={1} step={0.05} set={v => update('opacity', v)} />
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.fontSize')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{settings.fontSize}px</span></Item>
              <Slider value={settings.fontSize} min={12} max={18} step={1} set={v => update('fontSize', v)} unit="px" />
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.windowWidth')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{settings.windowWidth}px</span></Item>
              <Slider value={settings.windowWidth} min={350} max={600} step={10} set={v => update('windowWidth', v)} unit="px" />
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.windowHeight')}><span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{settings.windowHeight}px</span></Item>
              <Slider value={settings.windowHeight} min={400} max={800} step={10} set={v => update('windowHeight', v)} unit="px" />
            </Card>
          </div>
        )
      case 'hotkeys':
        return (
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
                  {key !== 'clearHotkey' && <div className="h-px" style={{ background: 'var(--border-divider)' }} />}
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
      case 'storage':
        return (
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
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.dataEncryption')} desc={t('settings.dataEncryptionDesc')}>
                <span className="rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: securityStatus?.active ? 'var(--color-success)' : 'var(--color-warning)', background: securityStatus?.active ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-warning) 12%, transparent)' }}>
                  {securityStatus?.active ? t('settings.encryptionEnabled') : securityStatus?.migrating ? t('settings.encryptionMigrating') : t('settings.encryptionUnavailable')}
                </span>
              </Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>
                  {t('settings.cleanupDesc')}
                </p>
                <button onClick={cleanupCache} className="px-3 py-1.5 rounded-lg text-[11px] interactive-chip flex-shrink-0"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }}>
                  {t('settings.cleanup')}
                </button>
              </div>
              {cacheMessage && <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{cacheMessage}</p>}
            </Card>
          </div>
        )
      case 'notifications':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title={t('settings.notification')} icon={<Bell size={14} color="var(--color-primary-light)" />}>
              <Item label={t('settings.copySound')} desc={t('settings.copySoundDesc')}><Toggle on={settings.soundEnabled} set={v => update('soundEnabled', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.autoCheckUpdates')} desc={t('settings.autoCheckUpdatesDesc')}><Toggle on={settings.autoCheckUpdates} set={v => update('autoCheckUpdates', v)} /></Item>
            </Card>
          </div>
        )
      case 'help':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title={t('settings.updates')} icon={<RefreshCw size={14} color="var(--color-success)" />}>
              <UpdateStatus />
            </Card>
          </div>
        )
      case 'about':
        return (
          <div className="space-y-4 slide-in-right">
            <div className="glass-card rounded-lg p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center shimmer soft-float overflow-hidden"
                style={{
                  boxShadow: '0 8px 24px color-mix(in srgb, var(--color-primary) 25%, transparent)',
                }}>
                <img src={appIconUrl} alt="" className="w-16 h-16 rounded-lg" draggable={false} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>ClipMaster</h2>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.aboutSubtitle')}</p>
                <p className="text-[11px] mt-2 font-mono" style={{ color: 'var(--text-ghost)' }}>v{appVersion || '...'}</p>
              </div>
            </div>
            <Card title={t('settings.techStack')} icon={<Heart size={14} color="#f472b6" />}>
              <div className="grid grid-cols-2 gap-2">
                {['Electron', 'React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand', 'Lucide', 'date-fns'].map(t => (
                  <div key={t} className="flex items-center gap-2 p-2 rounded-lg interactive-chip"
                    style={{ background: 'var(--bg-surface)' }}>
                    <div className="w-1 h-1 rounded-full" style={{ background: 'var(--color-primary-light)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="settings-layout h-full flex">
      <div className="settings-sidebar w-36 flex-shrink-0 p-2.5 space-y-0.5"
        style={{ borderRight: '1px solid var(--border-divider)', background: 'var(--bg-surface)' }}>
        <div className="mb-3 px-2.5">
          <p className="text-[9px] uppercase font-semibold"
            style={{ color: 'var(--text-ghost)' }}>
            {t('settings.sidebar')}
          </p>
        </div>
        {sections.map(s => {
          const active = section === s.id
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium interactive-chip"
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
              }}>
              <s.Icon size={14} color={active ? 'var(--color-primary-light)' : undefined} strokeWidth={active ? 2.5 : 2} />
              <span>{s.label}</span>
            </button>
          )
        })}
      </div>
      <div className="settings-content flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  )
})

SettingsPanel.displayName = 'SettingsPanel'
export default SettingsPanel
