import React, { useState, useCallback, memo } from 'react'
import { Settings, Keyboard, Palette, Database, Bell, Monitor, Sun, Moon, Sliders, Info, Zap, Heart } from 'lucide-react'
import { useClipboardStore } from '../store/clipboardStore'

const SettingsPanel: React.FC = memo(() => {
  const settings = useClipboardStore(s => s.settings)
  const setSettings = useClipboardStore(s => s.setSettings)
  const historyLen = useClipboardStore(s => s.history.length)
  const [section, setSection] = useState('general')

  const update = useCallback(<K extends keyof typeof settings>(key: K, val: typeof settings[K]) => {
    const current = useClipboardStore.getState().settings
    const next = { ...current, [key]: val }
    setSettings(next)
    window.electronAPI?.updateSettings(next)
  }, [setSettings])

  const sections = [
    { id: 'general', label: '通用设置', Icon: Settings },
    { id: 'appearance', label: '外观主题', Icon: Palette },
    { id: 'hotkeys', label: '快捷键', Icon: Keyboard },
    { id: 'storage', label: '数据存储', Icon: Database },
    { id: 'notifications', label: '通知提醒', Icon: Bell },
    { id: 'about', label: '关于', Icon: Info },
  ]

  const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void }> = ({ on, set }) => (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => set(!on)} />
  )

  const Slider: React.FC<{ value: number; min: number; max: number; step: number; set: (v: number) => void; unit?: string }> = ({ value, min, max, step, set, unit }) => (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)} className="flex-1" />
      <span className="text-sm w-14 text-right font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{value}{unit || ''}</span>
    </div>
  )

  const Item: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
    <div className="setting-item">
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</p>
        {desc && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  )

  const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
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
            <Card title="功能设置" icon={<Zap size={15} color="#4c6ef5" />}>
              <Item label="开机自启动" desc="Windows 启动时自动运行"><Toggle on={settings.autoStart} set={v => update('autoStart', v)} /></Item>
              <div className="h-px bg-white/5" />
              <Item label="最小化到托盘" desc="关闭窗口时继续在后台监控"><Toggle on={settings.minimizeToTray} set={v => update('minimizeToTray', v)} /></Item>
              <div className="h-px bg-white/5" />
              <Item label="双击复制" desc="双击项目时自动复制"><Toggle on={settings.copyOnSelect} set={v => update('copyOnSelect', v)} /></Item>
              <div className="h-px bg-white/5" />
              <Item label="悬停预览" desc="鼠标悬停时显示完整内容"><Toggle on={settings.showPreview} set={v => update('showPreview', v)} /></Item>
            </Card>
            <Card title="历史记录" icon={<Database size={15} color="#4c6ef5" />}>
              <Item label="最大保存数量"><span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{settings.maxHistory} 条</span></Item>
              <Slider value={settings.maxHistory} min={50} max={500} step={10} set={v => update('maxHistory', v)} />
            </Card>
          </div>
        )
      case 'appearance':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title="主题风格" icon={<Palette size={15} color="#4c6ef5" />}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'dark', label: '深色', Icon: Moon, grad: 'linear-gradient(135deg, #374151, #111827)' },
                  { id: 'light', label: '浅色', Icon: Sun, grad: 'linear-gradient(135deg, #e5e7eb, #fff)' },
                  { id: 'auto', label: '跟随系统', Icon: Monitor, grad: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
                ].map(t => (
                  <button key={t.id} onClick={() => update('theme', t.id as any)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                    style={{
                      background: settings.theme === t.id ? 'rgba(76,110,245,0.1)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${settings.theme === t.id ? 'rgba(76,110,245,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: t.grad }}>
                      <t.Icon size={18} color={t.id === 'light' ? '#1f2937' : 'white'} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: settings.theme === t.id ? 'white' : 'rgba(255,255,255,0.5)' }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card title="界面调整" icon={<Sliders size={15} color="#4c6ef5" />}>
              <Item label="窗口透明度"><span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{Math.round(settings.opacity * 100)}%</span></Item>
              <Slider value={settings.opacity} min={0.7} max={1} step={0.05} set={v => update('opacity', v)} />
              <div className="h-px bg-white/5" />
              <Item label="字体大小"><span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{settings.fontSize}px</span></Item>
              <Slider value={settings.fontSize} min={12} max={18} step={1} set={v => update('fontSize', v)} unit="px" />
              <div className="h-px bg-white/5" />
              <Item label="窗口宽度"><span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{settings.windowWidth}px</span></Item>
              <Slider value={settings.windowWidth} min={350} max={600} step={10} set={v => update('windowWidth', v)} unit="px" />
              <div className="h-px bg-white/5" />
              <Item label="窗口高度"><span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{settings.windowHeight}px</span></Item>
              <Slider value={settings.windowHeight} min={400} max={800} step={10} set={v => update('windowHeight', v)} unit="px" />
            </Card>
          </div>
        )
      case 'hotkeys':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title="快捷键说明" icon={<Keyboard size={15} color="#4c6ef5" />}>
              {[
                { keys: ['Ctrl', 'Shift', 'V'], desc: '显示/隐藏窗口', global: true },
                { keys: ['Ctrl', 'F'], desc: '聚焦搜索框', global: false },
                { keys: ['↑', '↓'], desc: '上下导航', global: false },
                { keys: ['Enter'], desc: '复制选中项', global: false },
                { keys: ['Esc'], desc: '清空搜索', global: false },
                { keys: ['Delete'], desc: '删除选中项', global: false },
              ].map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{h.desc}</span>
                    {h.global && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: '#4c6ef5', background: 'rgba(76,110,245,0.1)' }}>全局</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {h.keys.map((k, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>+</span>}
                        <kbd className="px-2 py-1 rounded-md text-xs font-mono min-w-[28px] text-center"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>{k}</kbd>
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
            <Card title="存储概览" icon={<Database size={15} color="#4c6ef5" />}>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(76,110,245,0.08)', border: '1px solid rgba(76,110,245,0.1)' }}>
                  <p className="text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{historyLen}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>当前记录</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(32,201,151,0.08)', border: '1px solid rgba(32,201,151,0.1)' }}>
                  <p className="text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{useClipboardStore.getState().history.filter(h => h.pinned).length}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>收藏数量</p>
                </div>
              </div>
            </Card>
          </div>
        )
      case 'notifications':
        return (
          <div className="space-y-4 slide-in-right">
            <Card title="通知设置" icon={<Bell size={15} color="#4c6ef5" />}>
              <Item label="复制提示音" desc="复制内容时播放提示音"><Toggle on={settings.soundEnabled} set={v => update('soundEnabled', v)} /></Item>
            </Card>
          </div>
        )
      case 'about':
        return (
          <div className="space-y-4 slide-in-right">
            <div className="glass-card rounded-xl p-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #4c6ef5, #3b5bdb)', boxShadow: '0 8px 24px rgba(76,110,245,0.3)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>ClipMaster</h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>现代化剪贴板管理器</p>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>版本 1.0.0</p>
              </div>
            </div>
            <Card title="技术栈" icon={<Heart size={15} color="#f06595" />}>
              <div className="grid grid-cols-2 gap-2">
                {['Electron', 'React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand', 'Lucide', 'date-fns'].map(t => (
                  <div key={t} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4c6ef5' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{t}</span>
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
      <div className="w-40 border-r border-white/5 p-3 space-y-1" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="mb-4 px-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.2)' }}>设置</p>
        </div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${section === s.id ? '' : ''}`}
            style={{
              color: section === s.id ? 'white' : 'rgba(255,255,255,0.4)',
              background: section === s.id ? 'rgba(76,110,245,0.12)' : 'transparent',
            }}>
            <s.Icon size={14} color={section === s.id ? '#4c6ef5' : undefined} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  )
})

SettingsPanel.displayName = 'SettingsPanel'
export default SettingsPanel
