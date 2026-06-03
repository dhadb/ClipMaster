import React, { useMemo, memo } from 'react'
import { BarChart3, Clock, Type, Link, Code, Mail, Hash, FileText, Zap } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const TYPE_MAP: Record<string, { Icon: any; cssVar: string; label: string }> = {
  text: { Icon: Type, cssVar: 'var(--type-text)', label: '文本' },
  link: { Icon: Link, cssVar: 'var(--type-link)', label: '链接' },
  code: { Icon: Code, cssVar: 'var(--type-code)', label: '代码' },
  email: { Icon: Mail, cssVar: 'var(--type-email)', label: '邮箱' },
  color: { Icon: Hash, cssVar: 'var(--type-color)', label: '颜色' },
  number: { Icon: Hash, cssVar: 'var(--type-number)', label: '数字' },
  'long-text': { Icon: FileText, cssVar: 'var(--type-long-text)', label: '长文本' },
}

const StatsPanel: React.FC = memo(() => {
  const history = useClipboardStore(s => s.history)

  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const week = new Date(today.getTime() - 7 * 86400000)

    const typeCount: Record<string, number> = {}
    let totalChars = 0
    const hourly = new Array(24).fill(0)

    for (const item of history) {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1
      totalChars += item.content.length
      hourly[new Date(item.timestamp).getHours()]++
    }

    return {
      total: history.length,
      favorited: history.filter(h => h.favorited).length,
      today: history.filter(h => new Date(h.timestamp) >= today).length,
      week: history.filter(h => new Date(h.timestamp) >= week).length,
      totalChars,
      avgLen: history.length > 0 ? Math.round(totalChars / history.length) : 0,
      typeCount,
      hourly,
      peakHour: history.length > 0 ? hourly.indexOf(Math.max(...hourly)) : -1,
    }
  }, [history])

  const maxHourly = Math.max(...stats.hourly, 1)

  const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
        {icon}<span>{title}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="flex items-center gap-2 fade-in">
        <BarChart3 size={16} color="#6366f1" />
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>使用统计</h2>
      </div>

      {/* 主要统计 */}
      <div className="grid grid-cols-2 gap-2.5 fade-in" style={{ animationDelay: '50ms' }}>
        {[
          { label: '总记录', value: stats.total, color: '#6366f1' },
          { label: '已收藏', value: stats.favorited, color: '#fbbf24' },
          { label: '今日', value: stats.today, color: '#34d399' },
          { label: '本周', value: stats.week, color: '#818cf8' },
        ].map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-3.5">
            <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-ghost)' }}>{s.label}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 文本统计 */}
      <Card title="文本统计" icon={<Type size={13} color="#6366f1" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{stats.totalChars.toLocaleString()}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>总字符数</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{stats.avgLen}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>平均长度</p>
          </div>
        </div>
      </Card>

      {/* 类型分布 */}
      <Card title="类型分布" icon={<Zap size={13} color="#6366f1" />}>
        <div className="space-y-2">
          {Object.entries(stats.typeCount).sort(([, a], [, b]) => b - a).map(([type, count]) => {
            const cfg = TYPE_MAP[type] || TYPE_MAP.text
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
            return (
              <div key={type} className="flex items-center gap-2.5">
                <cfg.Icon size={13} color={cfg.cssVar} strokeWidth={2} />
                <span className="text-[11px] w-10" style={{ color: 'var(--text-secondary)' }}>{cfg.label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${pct}%`,
                    background: cfg.cssVar,
                    opacity: 0.7,
                    transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                  }} />
                </div>
                <span className="text-[11px] w-14 text-right tabular-nums" style={{ color: 'var(--text-ghost)' }}>
                  {count} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 时段分布 */}
      <Card title="时段分布" icon={<Clock size={13} color="#6366f1" />}>
        <div className="flex justify-end mb-1">
          <span className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>
            {stats.peakHour >= 0 ? `高峰: ${stats.peakHour}:00` : '暂无数据'}
          </span>
        </div>
        <div className="flex items-end gap-px h-14">
          {stats.hourly.map((c, h) => (
            <div key={h} className="flex-1 flex flex-col items-center">
              <div className="w-full rounded-t" style={{
                height: `${(c / maxHourly) * 100}%`,
                minHeight: c > 0 ? 2 : 0,
                background: `linear-gradient(to top, var(--color-primary), var(--color-primary-light))`,
                opacity: 0.7,
                transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--text-ghost)' }}>
          <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
        </div>
      </Card>
    </div>
  )
})

StatsPanel.displayName = 'StatsPanel'
export default StatsPanel
