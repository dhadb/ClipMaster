import React from 'react'

/** 开关控件：role=switch + aria-checked，供设置项复用 */
export const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void }> = ({ on, set }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    className={`toggle ${on ? 'on' : ''}`}
    onClick={() => set(!on)}
  />
)

/** 滑块控件：数值 + 单位只读回显 */
export const Slider: React.FC<{ value: number; min: number; max: number; step: number; set: (v: number) => void; unit?: string }> = ({ value, min, max, step, set, unit }) => (
  <div className="flex items-center gap-3">
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)} className="flex-1" />
    <span className="text-[13px] w-14 text-right font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>{value}{unit || ''}</span>
  </div>
)

/** 单个设置行：左侧标题/说明，右侧控件 */
export const Item: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="setting-item">
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {desc && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{desc}</p>}
    </div>
    <div className="flex-shrink-0 ml-4">{children}</div>
  </div>
)

/** 设置分组卡片 */
export const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="setting-section p-5 space-y-4">
    <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
      {icon}{title}
    </h3>
    {children}
  </div>
)

/** 设置行之间的分隔线 */
export const Divider: React.FC = () => <div className="h-px" style={{ background: 'var(--border-divider)' }} />
