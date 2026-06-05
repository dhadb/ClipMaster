import React from 'react'
import { Clipboard, Search, Star, ArrowDown, Keyboard, Copy } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'
import { useI18n } from '../i18n'

const EmptyState: React.FC = () => {
  const activeTab = useClipboardStore(s => s.activeTab)
  const searchQuery = useClipboardStore(s => s.searchQuery)
  const { t } = useI18n()

  const isSearching = searchQuery.length > 0
  const isFavorites = activeTab === 'favorites'

  const MainIcon = isSearching ? Search : isFavorites ? Star : Clipboard
  const title = isSearching ? t('empty.noMatches') : isFavorites ? t('empty.noFavorites') : t('empty.emptyClipboard')
  const desc = isSearching ? t('empty.tryOther') : isFavorites ? t('empty.favoriteHint') : t('empty.copyHint')

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 py-10">
      {/* 图标 */}
      <div className="relative mb-6 fade-in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center soft-float shimmer"
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.08)',
          }}>
          <MainIcon size={30} color={isFavorites ? 'var(--color-warning)' : 'var(--color-primary)'} strokeWidth={1.5}
            style={{ opacity: 0.5 }} />
        </div>
      </div>

      {/* 文字 */}
      <div className="text-center space-y-2 max-w-[260px] fade-in" style={{ animationDelay: '80ms' }}>
        <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{desc}</p>
      </div>

      {/* 提示 */}
      {!isSearching && !isFavorites && (
        <div className="mt-6 px-4 py-2 rounded-full fade-in"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            animationDelay: '160ms',
          }}>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <ArrowDown size={13} color="#6366f1" />
            <span>{t('empty.start')}</span>
          </div>
        </div>
      )}

      {/* 快捷键提示 */}
      {!isSearching && (
        <div className="mt-8 grid grid-cols-2 gap-2 w-full max-w-[280px] fade-in" style={{ animationDelay: '240ms' }}>
          {[
            { icon: Keyboard, label: 'Ctrl+Shift+V', desc: t('empty.quickOpen') },
            { icon: Search, label: 'Ctrl+F', desc: t('empty.searchContent') },
            { icon: Copy, label: t('empty.doubleClick'), desc: t('empty.quickCopy') },
            { icon: Star, label: t('tabs.favorites'), desc: t('empty.favoriteContent') },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg interactive-chip"
              style={{ background: 'var(--bg-surface)' }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)' }}>
                <tip.icon size={11} color="var(--text-ghost)" />
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{tip.label}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-ghost)' }}>{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(EmptyState)
