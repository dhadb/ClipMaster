import React, { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { Settings, Keyboard, Palette, Database, Bell, Info, HelpCircle } from 'lucide-react'
import { useClipboardStore, type Settings as ClipboardSettings } from '../store/clipboardStore'
import { useI18n } from '../i18n'
import GeneralSection from './settings/GeneralSection'
import AppearanceSection from './settings/AppearanceSection'
import HotkeysSection from './settings/HotkeysSection'
import StorageSection from './settings/StorageSection'
import StorageHealthSection from './settings/StorageHealthSection'
import NotificationsSection from './settings/NotificationsSection'
import HelpSection from './settings/HelpSection'
import AboutSection from './settings/AboutSection'
import type { HotkeySettingKey, DataSecurityStatus, UpdateFn } from './settings/types'
import { useStorageHealth } from '../hooks/useStorageHealth'

const SettingsPanel: React.FC = memo(() => {
  const settings = useClipboardStore(s => s.settings)
  const updateSettings = useClipboardStore(s => s.updateSettings)
  const historyLen = useClipboardStore(s => s.history.length)
  const history = useClipboardStore(s => s.history)
  const appVersion = useClipboardStore(s => s.appVersion)
  const { t } = useI18n()

  const [section, setSection] = useState('general')
  const [hotkeyDrafts, setHotkeyDrafts] = useState<Record<HotkeySettingKey, string>>({ hotkey: settings.hotkey, searchHotkey: settings.searchHotkey, clearHotkey: settings.clearHotkey })
  const [hotkeyMessage, setHotkeyMessage] = useState('')
  const [ignoredDraft, setIgnoredDraft] = useState(settings.ignoredPatterns.join('\n'))
  const [blockedApplicationsDraft, setBlockedApplicationsDraft] = useState(settings.blockedApplications.join('\n'))
  const [cacheMessage, setCacheMessage] = useState('')
  const [securityStatus, setSecurityStatus] = useState<DataSecurityStatus>(null)
  const storageHealth = useStorageHealth()

  const favoriteCount = useMemo(() => history.filter(item => item.favorited).length, [history])
  const imageCount = useMemo(() => history.filter(item => item.type === 'image').length, [history])

  useEffect(() => {
    setHotkeyDrafts({ hotkey: settings.hotkey, searchHotkey: settings.searchHotkey, clearHotkey: settings.clearHotkey })
    setIgnoredDraft(settings.ignoredPatterns.join('\n'))
    setBlockedApplicationsDraft(settings.blockedApplications.join('\n'))
  }, [settings.hotkey, settings.searchHotkey, settings.clearHotkey, settings.ignoredPatterns, settings.blockedApplications])

  useEffect(() => {
    window.electronAPI?.getDataSecurityStatus().then(setSecurityStatus).catch(() => setSecurityStatus(null))
  }, [])

  const update: UpdateFn = useCallback(async <K extends keyof ClipboardSettings>(key: K, val: ClipboardSettings[K]) => {
    try {
      const applied = await updateSettings({ [key]: val } as Partial<ClipboardSettings>)
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
    void update('ignoredPatterns', patterns)
  }, [ignoredDraft, update])

  const saveBlockedApplications = useCallback(() => {
    const applications = blockedApplicationsDraft.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    void update('blockedApplications', applications)
  }, [blockedApplicationsDraft, update])

  const updateSensitiveRule = useCallback((rule: keyof ClipboardSettings['sensitiveRules'], enabled: boolean) => {
    void update('sensitiveRules', { ...settings.sensitiveRules, [rule]: enabled })
  }, [settings.sensitiveRules, update])

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

  const renderContent = () => {
    switch (section) {
      case 'general':
        return (
          <GeneralSection
            settings={settings}
            update={update}
            updateSensitiveRule={updateSensitiveRule}
            ignoredDraft={ignoredDraft}
            setIgnoredDraft={setIgnoredDraft}
            saveIgnoredPatterns={saveIgnoredPatterns}
            blockedApplicationsDraft={blockedApplicationsDraft}
            setBlockedApplicationsDraft={setBlockedApplicationsDraft}
            saveBlockedApplications={saveBlockedApplications}
            t={t}
          />
        )
      case 'appearance':
        return <AppearanceSection settings={settings} update={update} t={t} />
      case 'hotkeys':
        return <HotkeysSection hotkeyDrafts={hotkeyDrafts} setHotkeyDrafts={setHotkeyDrafts} update={update} hotkeyMessage={hotkeyMessage} t={t} />
      case 'storage':
        return (
          <div className="space-y-4">
            <StorageSection historyLen={historyLen} favoriteCount={favoriteCount} imageCount={imageCount} securityStatus={securityStatus} cleanupCache={cleanupCache} cacheMessage={cacheMessage} t={t} />
            <StorageHealthSection health={storageHealth} t={t} />
          </div>
        )
      case 'notifications':
        return <NotificationsSection settings={settings} update={update} t={t} />
      case 'help':
        return <HelpSection t={t} />
      case 'about':
        return <AboutSection appVersion={appVersion} t={t} />
      default:
        return null
    }
  }

  return (
    <div className="settings-layout h-full flex">
      <div className="settings-sidebar w-36 flex-shrink-0 p-2.5 space-y-0.5"
        style={{ borderRight: '1px solid var(--border-divider)', background: 'var(--bg-surface)' }}>
        <div className="mb-3 px-2.5">
          <p className="text-[9px] uppercase font-semibold" style={{ color: 'var(--text-ghost)' }}>
            {t('settings.sidebar')}
          </p>
        </div>
        {sections.map(s => {
          const active = section === s.id
          return (
            <button key={s.id} type="button" onClick={() => setSection(s.id)}
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
