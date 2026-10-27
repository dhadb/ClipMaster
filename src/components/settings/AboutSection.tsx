import React from 'react'
import { Heart } from 'lucide-react'
import { Card } from '../ui/SettingControls'
import type { TFunc } from './types'

const appIconUrl = './icon.png'

interface Props {
  appVersion: string
  t: TFunc
}

const AboutSection: React.FC<Props> = ({ appVersion, t }) => (
  <div className="space-y-4 slide-in-right">
    <div className="glass-card rounded-lg p-6 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center overflow-hidden"
        style={{ boxShadow: '0 8px 24px color-mix(in srgb, var(--color-primary) 25%, transparent)' }}>
        <img src={appIconUrl} alt="" className="w-16 h-16 rounded-lg" draggable={false} />
      </div>
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>ClipMaster</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('settings.aboutSubtitle')}</p>
        <p className="text-[11px] mt-2 font-mono" style={{ color: 'var(--text-ghost)' }}>v{appVersion || '...'}</p>
      </div>
    </div>
    <Card title={t('settings.techStack')} icon={<Heart size={14} color="var(--color-favorite)" />}>
      <div className="grid grid-cols-2 gap-2">
        {['Electron', 'React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand', 'Lucide', 'date-fns'].map(tech => (
          <div key={tech} className="flex items-center gap-2 p-2 rounded-lg interactive-chip"
            style={{ background: 'var(--bg-surface)' }}>
            <div className="w-1 h-1 rounded-full" style={{ background: 'var(--color-primary-light)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{tech}</span>
          </div>
        ))}
      </div>
    </Card>
  </div>
)

export default AboutSection
