import React, { useMemo, memo } from 'react'
import { BarChart3, Clock, Type, Link, Code, Mail, Hash, FileText, Zap } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const TYPE_MAP: Record<string, { Icon: any; color: string; label: string }> = {
  text: { Icon: Type, color: '#5c7cfa', label: '文本' },
  link: { Icon: Link, color: '#20c997', label: '链接' },
  code: { Icon: Code, color: '#845ef7', label: '代码' },
  email: { Icon: Mail, color: '#f06595', label: '邮箱' },
  color: { Icon: Hash, color: '#ff922b', label: '颜色' },
  number: { Icon: Hash, color: '#fab005', label: '数字' },
  'long-text': { Icon: FileText, color: '#748ffc', label: '长文本' },
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
      pinned: history.filter(h => h.pinned).length,
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
      <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {icon}<span>{title}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 fade-in">
        <BarChart3 size={18} color="#4c6ef5" />
        <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>使用统计</h2>
      </div>

      {/* 主要统计 */}
      <div className="grid grid-cols-2 gap-3 fade-in" style={{ animationDelay: '50ms' }}>
        {[
          { label: '总记录', value: stats.total, color: '#4c6ef5' },
          { label: '已收藏', value: stats.pinned, color: '#fab005' },
          { label: '今日', value: stats.today, color: '#20c997' },
          { label: '本周', value: stats.week, color: '#5c7cfa' },
        ].map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-4">
            <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 文本统计 */}
      <Card title="文本统计" icon={<Type size={14} color="#4c6ef5" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{stats.totalChars.toLocaleString()}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>总字符数</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{stats.avgLen}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>平均长度</p>
          </div>
        </div>
      </Card>

      {/* 类型分布 */}
      <Card title="类型分布" icon={<Zap size={14} color="#4c6ef5" />}>
        <div className="space-y-2">
          {Object.entries(stats.typeCount).sort(([, a], [, b]) => b - a).map(([type, count]) => {
            const cfg = TYPE_MAP[type] || TYPE_MAP.text
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
            return (
              <div key={type} className="flex items-center gap-3">
                <cfg.Icon size={14} color={cfg.color} />
                <span className="text-xs w-12" style={{ color: 'rgba(255,255,255,0.5)' }}>{cfg.label}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color, transition: 'width 0.5s ease' }} />
                </div>
                <span className="text-xs w-14 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>{count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 时段分布 */}
      <Card title="时段分布" icon={<Clock size={14} color="#4c6ef5" />}>
        <div className="flex justify-end mb-1">
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {stats.peakHour >= 0 ? `高峰: ${stats.peakHour}:00` : '暂无数据'}
          </span>
        </div>
        <div className="flex items-end gap-px h-16">
          {stats.hourly.map((c, h) => (
            <div key={h} className="flex-1 flex flex-col items-center">
              <div className="w-full rounded-t" style={{
                height: `${(c / maxHourly) * 100}%`,
                minHeight: c > 0 ? 3 : 0,
                background: 'linear-gradient(to top, #4c6ef5, #748ffc)',
                transition: 'height 0.4s ease',
              }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
        </div>
      </Card>
    </div>
  )
})

StatsPanel.displayName = 'StatsPanel'
export default StatsPanel
