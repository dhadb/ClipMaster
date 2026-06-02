import React from 'react'
import { Clipboard, Search, Star, ArrowDown, Keyboard, Copy } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const EmptyState: React.FC = () => {
  const activeTab = useClipboardStore(s => s.activeTab)
  const searchQuery = useClipboardStore(s => s.searchQuery)

  const isSearching = searchQuery.length > 0
  const isFavorites = activeTab === 'favorites'

  const MainIcon = isSearching ? Search : isFavorites ? Star : Clipboard
  const title = isSearching ? '没有找到匹配项' : isFavorites ? '还没有收藏内容' : '剪贴板是空的'
  const desc = isSearching ? '试试其他关键词' : isFavorites ? '点击 ⭐ 图标添加收藏' : '复制任意内容，它们会自动出现'

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 py-10">
      {/* 图标 */}
      <div className="relative mb-8 fade-in">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(76,110,245,0.15), rgba(59,91,219,0.15))', border: '1px solid rgba(76,110,245,0.15)' }}>
          <MainIcon size={36} color={isFavorites ? 'rgba(250,176,5,0.6)' : 'rgba(76,110,245,0.6)'} />
        </div>
      </div>

      {/* 文字 */}
      <div className="text-center space-y-3 max-w-[280px] fade-in" style={{ animationDelay: '100ms' }}>
        <h3 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
      </div>

      {/* 提示 */}
      {!isSearching && !isFavorites && (
        <div className="mt-8 px-4 py-2.5 rounded-full fade-in" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <ArrowDown size={14} color="#4c6ef5" />
            <span>复制任意内容开始使用</span>
          </div>
        </div>
      )}

      {/* 快捷键提示 */}
      {!isSearching && (
        <div className="mt-10 grid grid-cols-2 gap-2 w-full max-w-[300px] fade-in" style={{ animationDelay: '300ms' }}>
          {[
            { icon: Keyboard, label: 'Ctrl+Shift+V', desc: '快速唤起' },
            { icon: Search, label: 'Ctrl+F', desc: '搜索内容' },
            { icon: Copy, label: '双击', desc: '快速复制' },
            { icon: Star, label: '⭐', desc: '收藏内容' },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tip.icon size={12} color="rgba(255,255,255,0.3)" />
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{tip.label}</p>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(EmptyState)
