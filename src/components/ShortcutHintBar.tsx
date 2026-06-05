import React from 'react'
import { Keyboard, CornerDownLeft, Trash2, Command } from 'lucide-react'
import { useI18n } from '../i18n'

const ShortcutHintBar: React.FC = () => {
  const { t } = useI18n()
  const tips = [
    { icon: Keyboard, key: '↑ / ↓', text: t('shortcut.select') },
    { icon: CornerDownLeft, key: 'Enter', text: t('shortcut.copy') },
    { icon: Command, key: 'Alt+1~9', text: t('shortcut.quickCopy') },
    { icon: Trash2, key: 'Del', text: t('shortcut.delete') },
  ]
  return (
    <div className="px-3 pb-2">
      <div className="grid grid-cols-4 gap-1.5 rounded-xl px-2 py-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}>
        {tips.map(tip => (
          <div key={tip.key} className="flex items-center justify-center gap-1 min-w-0">
            <tip.icon size={10} color="var(--text-ghost)" className="flex-shrink-0" />
            <span className="text-[9px] font-medium truncate" style={{ color: 'var(--text-tertiary)' }}>{tip.key}</span>
            <span className="text-[9px] truncate" style={{ color: 'var(--text-ghost)' }}>{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default React.memo(ShortcutHintBar)
