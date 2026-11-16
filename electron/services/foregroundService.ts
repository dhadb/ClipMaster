import { execFile } from 'child_process'
import type { ForegroundDetector, ForegroundTarget } from './ports'
import type { AppServices } from './index'

export type { ForegroundTarget }

const foregroundProcessScript = [
  '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
  'Add-Type @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class ClipMasterForeground {',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '}',
  '"@',
  '$processId = [uint32]0',
  '$window = [ClipMasterForeground]::GetForegroundWindow()',
  'if ($window -eq [IntPtr]::Zero) { return }',
  '[void][ClipMasterForeground]::GetWindowThreadProcessId($window, [ref]$processId)',
  'if (!$processId) { return }',
  '$process = Get-Process -Id $processId -ErrorAction SilentlyContinue',
  'if ($null -eq $process) { return }',
  '[PSCustomObject]@{ hwnd = $window.ToInt64().ToString([System.Globalization.CultureInfo]::InvariantCulture); processId = [int64]$processId; processName = [string]$process.ProcessName } | ConvertTo-Json -Compress',
].join('\n')

const workspaceNames: Record<string, string> = {
  code: 'VS Code',
  devenv: 'Visual Studio',
  chrome: 'Chrome',
  msedge: 'Microsoft Edge',
  firefox: 'Firefox',
  wechat: 'WeChat',
}

/** 纯函数：把 PowerShell 输出解析为前台目标；非法输出返回 null。 */
export function parseForegroundTarget(output: string, now: number, normalizeWorkspace: (value: unknown) => string | undefined): ForegroundTarget | null {
  try {
    const raw = JSON.parse(output) as Record<string, unknown> | null
    const hwnd = typeof raw?.hwnd === 'string' ? raw.hwnd.trim() : ''
    const processName = typeof raw?.processName === 'string' ? raw.processName.trim().slice(0, 120) : ''
    const processId = typeof raw?.processId === 'number' ? raw.processId : Number(raw?.processId)
    const applicationKey = processName.toLowerCase().replace(/\.exe$/i, '')
    if (!/^\d{1,20}$/.test(hwnd) || !Number.isSafeInteger(processId) || processId <= 0 || !applicationKey) return null
    return {
      hwnd,
      processId,
      processName,
      applicationKey,
      workspace: workspaceNames[applicationKey] || normalizeWorkspace(processName) || applicationKey,
      capturedAt: now,
    }
  } catch {
    return null
  }
}

/** PowerShell 采样器（ForegroundDetector 默认实现）。 */
export function createPowerShellForegroundDetector(now: () => number, normalizeWorkspace: (value: unknown) => string | undefined): ForegroundDetector {
  return {
    sample: () => new Promise(resolve => {
      try {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', foregroundProcessScript], {
          encoding: 'utf8',
          timeout: 1200,
          windowsHide: true,
          maxBuffer: 4096,
        }, (error, stdout) => {
          resolve(error ? null : parseForegroundTarget(stdout.trim(), now(), normalizeWorkspace))
        })
      } catch {
        resolve(null)
      }
    }),
  }
}

// P0-3：应用级暂停开启时才用 1200ms（该功能必须秒级感知"用户切回来了"），
// 平时降到 2500ms，并把缓存 TTL 提到 3000ms 保证轮询间隔永远在有效期内，精度不降。
const FOREGROUND_TRACK_ACTIVE_MS = 1200
const FOREGROUND_TRACK_IDLE_MS = 2500
const FOREGROUND_CACHE_TTL_MS = 3000

export interface ForegroundService {
  isClipMasterTarget(target: ForegroundTarget | null): boolean
  sample(): Promise<ForegroundTarget | null>
  startTracker(): void
  stopTracker(): void
  refreshCadence(): void
  maybeResumeApplicationPause(): void
  getCachedWorkspace(): string
  getCachedApplication(): string | undefined
  getPauseTarget(): ForegroundTarget | null
}

export function createForegroundService(services: AppServices): ForegroundService {
  const rt = services.runtime
  const detector: ForegroundDetector = services.detector

  function isClipMasterTarget(target: ForegroundTarget | null) {
    if (!target) return false
    return target.applicationKey.includes('clipmaster') || (rt.isPackaged === false && target.applicationKey === 'electron')
  }

  function maybeResumeApplicationPause() {
    if (rt.pauseMode !== 'application') return
    const target = rt.currentForegroundTarget
    if (!target || isClipMasterTarget(target)) return
    if (rt.pausedApplicationKey) {
      if (target.applicationKey !== rt.pausedApplicationKey) services.privacy.resumeMonitoring()
      return
    }
    if (rt.pausedWorkspace && target.workspace !== rt.pausedWorkspace) services.privacy.resumeMonitoring()
  }

  function updateForegroundTarget(target: ForegroundTarget | null) {
    rt.currentForegroundTarget = target
    if (!target || isClipMasterTarget(target)) return
    rt.lastExternalForegroundTarget = { ...target }
    maybeResumeApplicationPause()
  }

  /** 采样并更新运行时缓存（带过期丢弃）。 */
  function sample(): Promise<ForegroundTarget | null> {
    if (process.platform !== 'win32' || rt.isQuitting) return Promise.resolve(null)
    const sampleId = ++rt.foregroundSampleSequence
    return detector.sample().then(target => {
      if (sampleId >= rt.lastAppliedForegroundSample) {
        rt.lastAppliedForegroundSample = sampleId
        updateForegroundTarget(target)
      }
      return target
    }).catch(() => null)
  }

  function runForegroundTrackerSample() {
    if (rt.foregroundTrackerRequestInFlight || rt.isQuitting) return
    rt.foregroundTrackerRequestInFlight = true
    void sample().finally(() => {
      rt.foregroundTrackerRequestInFlight = false
    })
  }

  function scheduleForegroundTrackerTick() {
    if (!rt.foregroundTracker || rt.isQuitting) return
    const delay = rt.pauseMode === 'application' ? FOREGROUND_TRACK_ACTIVE_MS : FOREGROUND_TRACK_IDLE_MS
    rt.foregroundTracker = setTimeout(() => {
      if (rt.isQuitting || !rt.foregroundTracker) return
      runForegroundTrackerSample()
      scheduleForegroundTrackerTick()
    }, delay)
  }

  function startTracker() {
    if (rt.foregroundTracker || process.platform !== 'win32' || rt.isQuitting) return
    runForegroundTrackerSample()
    scheduleForegroundTrackerTick()
  }

  function stopTracker() {
    if (rt.foregroundTracker) {
      clearTimeout(rt.foregroundTracker)
      rt.foregroundTracker = null
    }
  }

  /** pauseMode 变化后立刻切到对应采样频率，不用等下一轮 tick。 */
  function refreshCadence() {
    if (!rt.foregroundTracker) return
    stopTracker()
    startTracker()
  }

  function getCachedWorkspace() {
    const target = rt.currentForegroundTarget
    if (!target || isClipMasterTarget(target) || rt.now() - target.capturedAt > FOREGROUND_CACHE_TTL_MS) return ''
    return target.workspace
  }

  function getCachedApplication() {
    const target = rt.currentForegroundTarget
    if (!target || isClipMasterTarget(target) || rt.now() - target.capturedAt > FOREGROUND_CACHE_TTL_MS) return undefined
    return normalizeSourceApplication(target.processName)
  }

  function getPauseTarget() {
    const target = rt.quickPasteTarget || rt.lastExternalForegroundTarget
    if (!target || isClipMasterTarget(target)) return null
    return { ...target }
  }

  function normalizeSourceApplication(value: unknown) {
    if (typeof value !== 'string') return undefined
    // 等价于原 /[\u0000-\u001f]/g 清洗，但避免 no-control-regex 误报。
    const application = value.split('').map(ch => (ch.charCodeAt(0) < 0x20 ? '' : ch)).join('').trim().replace(/\.exe$/i, '').slice(0, 120)
    return application || undefined
  }

  return {
    isClipMasterTarget,
    sample,
    startTracker,
    stopTracker,
    refreshCadence,
    maybeResumeApplicationPause,
    getCachedWorkspace,
    getCachedApplication,
    getPauseTarget,
  }
}
