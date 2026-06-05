import React, { useState, useCallback, useEffect, memo } from 'react'
import { Settings, Keyboard, Palette, Database, Bell, Monitor, Sun, Moon, Sliders, Info, Zap, Heart, Shield, Image as ImageIcon, Globe2 } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const SettingsPanel: React.FC = memo(() => {
  const settings = useClipboardStore(s => s.settings)
  const setSettings = useClipboardStore(s => s.setSettings)
  const historyLen = useClipboardStore(s => s.history.length)
  const { t } = useI18n()
  const [section, setSection] = useState('general')
  const [hotkeyDraft, setHotkeyDraft] = useState(settings.hotkey)
  const [hotkeyMessage, setHotkeyMessage] = useState('')
  const [ignoredDraft, setIgnoredDraft] = useState(settings.ignoredPatterns.join('\n'))
  const [cacheMessage, setCacheMessage] = useState('')

  useEffect(() => {
    setHotkeyDraft(settings.hotkey)
    setIgnoredDraft(settings.ignoredPatterns.join('\n'))
  }, [settings.hotkey, settings.ignoredPatterns])

  const update = useCallback(async <K extends keyof typeof settings>(key: K, val: typeof settings[K]) => {
    const current = useClipboardStore.getState().settings
    const next = { ...current, [key]: val }
    setSettings(next)
    try {
      const applied = await window.electronAPI?.updateSettings({ [key]: val } as Partial<typeof settings>)
      if (applied) {
        setSettings(applied)
        if (key === 'hotkey') {
          const requested = String(val)
          if (applied.hotkey !== requested) {
            setHotkeyDraft(applied.hotkey)
            setHotkeyMessage(t('settings.hotkeyUnavailable'))
          } else {
            setHotkeyMessage(t('settings.hotkeyUpdated'))
          }
        }
      }
    } catch (err) {
      console.error('updateSettings failed:', err)
      setSettings(current)
      if (key === 'hotkey') setHotkeyMessage(t('settings.hotkeyFailed'))
    }
  }, [setSettings, t])

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
    <div className="glass-card rounded-xl p-5 space-y-4">
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
            <Card title={t('settings.feature')} icon={<Zap size={14} color="#6366f1" />}>
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
              <Item label={t('settings.shortcutHints')} desc={t('settings.shortcutHintsDesc')}><Toggle on={settings.showShortcutHints} set={v => update('showShortcutHints', v)} /></Item>
              <div className="h-px" style={{ background: 'var(--border-divider)' }} />
              <Item label={t('settings.showPreview')} desc={t('settings.showPreviewDesc')}><Toggle on={settings.showPreview} set={v => update('showPreview', v)} /></Item>
            </Card>
            <Card title={t('settings.ignoredRules')} icon={<Shield size={14} color="#34d399" />}>
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
            <Card title={t('settings.history')} icon={<Database size={14} color="#6366f1" />}>
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
            <Card title={t('settings.themeStyle')} icon={<Palette size={14} color="#6366f1" />}>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'dark', label: t('settings.dark'), Icon: Moon, grad: 'linear-gradient(135deg, #27272a, #18181b)' },
                  { id: 'light', label: t('settings.light'), Icon: Sun, grad: 'linear-gradient(135deg, #e4e4e7, #fafafa)' },
                  { id: 'auto', label: t('settings.autoTheme'), Icon: Monitor, grad: 'linear-gradient(135deg, #6366f1, #a78bfa)' },
                ].map(t => (
                  <button key={t.id} onClick={() => update('theme', t.id as any)}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-xl interactive-chip"
                    style={{
                      background: settings.theme === t.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-surface)',
                      border: `1px solid ${settings.theme === t.id ? 'rgba(99,102,241,0.25)' : 'var(--border-card)'}`,
                    }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: t.grad }}>
                      <t.Icon size={16} color={t.id === 'light' ? '#18181b' : 'white'} />
                    </div>
                    <span className="text-[11px] font-medium"
                      style={{ color: settings.theme === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
            <Card title={t('settings.language')} icon={<Globe2 size={14} color="#34d399" />}>
              <Item label={t('settings.language')} desc={t('settings.languageDesc')}>
                <div className="grid gap-1 rounded-lg p-1 min-w-[118px]" style={{ background: 'var(--bg-surface)' }}>
                  {[
                    { id: 'system', label: t('settings.languageSystem') },
                    { id: 'zh-CN', label: t('settings.languageZh') },
                    { id: 'en-US', label: t('settings.languageEn') },
                  ].map(lang => (
                    <button key={lang.id} onClick={() => update('language', lang.id as any)}
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
            <Card title={t('settings.interface')} icon={<Sliders size={14} color="#6366f1" />}>
              <Item label={t('settings.listDensity')} desc={t('settings.listDensityDesc')}>
                <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-surface)' }}>
                  {[
                    { id: 'compact', label: t('settings.compact') },
                    { id: 'normal', label: t('settings.normal') },
                    { id: 'comfortable', label: t('settings.comfortable') },
                  ].map(d => (
                    <button key={d.id} onClick={() => update('listDensity', d.id as any)}
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
            <Card title={t('settings.globalHotkey')} icon={<Keyboard size={14} color="#6366f1" />}>
              <Item label={t('settings.showHideWindow')} desc={t('settings.hotkeyExample')}>
                <input
                  value={hotkeyDraft}
                  onChange={e => setHotkeyDraft(e.target.value)}
                  onBlur={() => update('hotkey', hotkeyDraft)}
                  onKeyDown={e => { if (e.key === 'Enter') update('hotkey', hotkeyDraft) }}
                  className="px-2 py-1 rounded-md text-[12px] font-mono w-44"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-card)' }}
                />
              </Item>
              {hotkeyMessage && (
                <p className="text-[11px] px-1" style={{ color: hotkeyMessage === t('settings.hotkeyUnavailable') || hotkeyMessage === t('settings.hotkeyFailed') ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {hotkeyMessage}
                </p>
              )}
            </Card>
            <Card title={t('settings.hotkeyHelp')} icon={<Keyboard size={14} color="#6366f1" />}>
              {[
                { keys: settings.hotkey.split('+'), desc: t('settings.showHideWindow'), global: true },
                { keys: ['Ctrl', 'F'], desc: t('settings.focusSearch'), global: false },
                { keys: ['↑', '↓'], desc: t('settings.moveSelection'), global: false },
                { keys: ['Enter'], desc: t('settings.copySelection'), global: false },
                { keys: ['Esc'], desc: t('settings.clearSearch'), global: false },
                { keys: ['Delete'], desc: t('settings.deleteSelection'), global: false },
              ].map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--bg-surface)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{h.desc}</span>
                    {h.global && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ color: '#6366f1', background: 'rgba(99,102,241,0.08)' }}>
                        {t('settings.global')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {h.keys.map((k, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <span className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>+</span>}
                        <kbd className="px-2 py-1 rounded-md text-[11px] font-mono min-w-[26px] text-center"
                          style={{
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-card)',
                            boxShadow: 'var(--shadow-btn)',
                          }}>
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )
      case 'storage':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title={t('settings.storageOverview')} icon={<Database size={14} color="#6366f1" />}>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.08)' }}>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{historyLen}</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.currentRecords')}</p>
                </div>
                <div className="p-4 rounded-xl"
                  style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.08)' }}>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {useClipboardStore.getState().history.filter(h => h.favorited).length}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.favoriteCount')}</p>
                </div>
              </div>
            </Card>
            <Card title={t('settings.imageCache')} icon={<ImageIcon size={14} color="#34d399" />}>
              <Item label={t('settings.imageRecords')} desc={t('settings.imageRecordsDesc')}>
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {t('settings.countUnit', { count: useClipboardStore.getState().history.filter(h => h.type === 'image').length })}
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
            <Card title={t('settings.notification')} icon={<Bell size={14} color="#6366f1" />}>
              <Item label={t('settings.copySound')} desc={t('settings.copySoundDesc')}><Toggle on={settings.soundEnabled} set={v => update('soundEnabled', v)} /></Item>
            </Card>
          </div>
        )
      case 'about':
        return (
          <div className="space-y-4 slide-in-right">
            <div className="glass-card rounded-xl p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shimmer soft-float"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
                }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>ClipMaster</h2>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.aboutSubtitle')}</p>
                <p className="text-[11px] mt-2 font-mono" style={{ color: 'var(--text-ghost)' }}>v1.0.0</p>
              </div>
            </div>
            <Card title={t('settings.techStack')} icon={<Heart size={14} color="#f472b6" />}>
              <div className="grid grid-cols-2 gap-2">
                {['Electron', 'React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand', 'Lucide', 'date-fns'].map(t => (
                  <div key={t} className="flex items-center gap-2 p-2 rounded-lg interactive-chip"
                    style={{ background: 'var(--bg-surface)' }}>
                    <div className="w-1 h-1 rounded-full" style={{ background: '#6366f1' }} />
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
    <div className="h-full flex">
      <div className="w-36 flex-shrink-0 p-2.5 space-y-0.5"
        style={{ borderRight: '1px solid var(--border-divider)', background: 'var(--bg-surface)' }}>
        <div className="mb-3 px-2.5">
          <p className="text-[9px] uppercase tracking-widest font-semibold"
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
                background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
              }}>
              <s.Icon size={14} color={active ? '#6366f1' : undefined} strokeWidth={active ? 2.5 : 2} />
              <span>{s.label}</span>
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  )
})

SettingsPanel.displayName = 'SettingsPanel'
export default SettingsPanel
