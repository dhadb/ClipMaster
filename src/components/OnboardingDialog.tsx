import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clipboard, Search, ShieldCheck, Sparkles, Tags } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const stepIcons = [Clipboard, Search, ShieldCheck]

const OnboardingDialog: React.FC = () => {
  const completed = useClipboardStore(state => state.settings.onboardingCompleted)
  const updateSettings = useClipboardStore(state => state.updateSettings)
  const setQuickAddOpen = useClipboardStore(state => state.setQuickAddOpen)
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (!completed) setStep(0)
  }, [completed])

  if (completed) return null
  const StepIcon = stepIcons[step]

  const finish = async (createSnippet = false) => {
    setSaving(true)
    setSaveFailed(false)
    try {
      await updateSettings({ onboardingCompleted: true })
      if (createSnippet) setQuickAddOpen(true)
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center p-3 detail-backdrop" style={{ background: 'color-mix(in srgb, var(--bg-root) 82%, transparent)', backdropFilter: 'blur(14px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-[calc(100vw-24px)] overflow-hidden rounded-xl detail-panel" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-app)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-divider)' }}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary-light)' }}><Sparkles size={15} /></div>
            <div>
              <h2 id="onboarding-title" className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('onboarding.title')}</h2>
              <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>{t('onboarding.step', { current: step + 1, total: 3 })}</p>
            </div>
          </div>
          <button onClick={() => void finish()} disabled={saving} className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>{t('onboarding.skip')}</button>
        </div>

        <div className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg" style={{ color: 'var(--color-primary-light)', background: 'color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))' }}><StepIcon size={20} /></div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t(`onboarding.${step + 1}.title` as Parameters<typeof t>[0])}</h3>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{t(`onboarding.${step + 1}.desc` as Parameters<typeof t>[0])}</p>
            </div>
          </div>

          {step === 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'Ctrl+Shift+V', label: t('onboarding.open') },
                { key: 'Ctrl+F', label: t('onboarding.find') },
                { key: 'Enter', label: t('onboarding.copy') },
              ].map(item => <div key={item.key} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}><kbd className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{item.key}</kbd><p className="mt-1.5 text-[9px]" style={{ color: 'var(--text-ghost)' }}>{item.label}</p></div>)}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}><Search size={13} color="var(--text-ghost)" /><span className="text-[11px]" style={{ color: 'var(--text-placeholder)' }}>#work type:code</span></div>
              <div className="flex gap-2"><span className="rounded-md px-2 py-1 text-[10px]" style={{ color: 'var(--color-primary-light)', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}><Tags size={10} className="mr-1 inline" />#work</span><span className="rounded-md px-2 py-1 text-[10px]" style={{ color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 12%, transparent)' }}>type:code</span></div>
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--color-success) 7%, var(--bg-surface))', border: '1px solid color-mix(in srgb, var(--color-success) 18%, var(--border-card))' }}><ShieldCheck size={15} color="var(--color-success)" /><p className="mt-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('onboarding.private')}</p></div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}><Clipboard size={15} color="var(--color-warning)" /><p className="mt-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('onboarding.local')}</p></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--border-divider)' }}>
          <div>
            <div className="flex gap-1.5">{[0, 1, 2].map(index => <span key={index} className="h-1.5 rounded-full transition-all" style={{ width: index === step ? 18 : 6, background: index === step ? 'var(--color-primary)' : 'var(--border-subtle)' }} />)}</div>
            {saveFailed && <p className="mt-1.5 text-[9px]" style={{ color: 'var(--color-danger)' }}>{t('onboarding.saveFailed')}</p>}
          </div>
          <div className="flex gap-2">
            {step > 0 && <button onClick={() => setStep(current => current - 1)} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] interactive-chip" style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}><ArrowLeft size={12} />{t('onboarding.back')}</button>}
            {step < 2
              ? <button onClick={() => setStep(current => current + 1)} className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-[11px] font-medium interactive-chip" style={{ color: 'white', background: 'var(--color-primary)' }}>{t('onboarding.next')}<ArrowRight size={12} /></button>
              : <button onClick={() => void finish(true)} disabled={saving} className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-[11px] font-medium interactive-chip disabled:opacity-50" style={{ color: 'white', background: 'var(--color-primary)' }}><Check size={12} />{t('onboarding.finish')}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingDialog
