import { getLocalDateKey, normalizeDailyCounter } from '../../src/utils/dailyCounter'
import { createGuardedIgnoredRuleMatcher } from '../../src/utils/ignoredRules'
import type { PrivacyState } from '../../shared/ipc-contract'
import type { AppServices } from './index'

export interface PrivacyService {
  rebuildMatcher(): void
  matchesIgnoredPattern(text: string): boolean
  refreshProtectedCounter(): boolean
  recordProtectedItem(): void
  isMonitoringPaused(): boolean
  getPrivacyState(): PrivacyState
  emitPrivacyState(): void
  pauseMonitoring(mode: number | 'until-resume' | 'application'): void
  resumeMonitoring(): void
}

export function createPrivacyService(services: AppServices): PrivacyService {
  const rt = services.runtime

  /**
   * 重建带护栏的忽略规则匹配器。慢规则（单次 >50ms）连续 3 次即在本次运行期内禁用，
   * console.warn + 记入 storageHealth.lastError 供诊断；按任务要求不做 UI 提示。
   */
  function rebuildMatcher() {
    const rules = rt.ignoredRules
    rt.guardedIgnoreMatcher = createGuardedIgnoredRuleMatcher(rules, {
      onSlowRule: (ruleIndex, elapsedMs, slowHits) => {
        const pattern = rt.settings.ignoredPatterns[ruleIndex] ?? `#${ruleIndex}`
        const message = `Slow ignored-rule disabled after ${slowHits} slow match(es) (${Math.round(elapsedMs)}ms): ${pattern}`
        console.warn(message)
        rt.storageHealth.lastError = message
      },
    })
  }

  function matchesIgnoredPattern(text: string) {
    return rt.guardedIgnoreMatcher(text)
  }

  function refreshProtectedCounter() {
    const next = normalizeDailyCounter(rt.protectedDate, rt.protectedToday)
    const changed = next.date !== rt.protectedDate || next.count !== rt.protectedToday
    rt.protectedDate = next.date
    rt.protectedToday = next.count
    return changed
  }

  function recordProtectedItem() {
    refreshProtectedCounter()
    rt.protectedToday += 1
    emitPrivacyState()
    services.storage.scheduleSave()
  }

  function isMonitoringPaused() {
    return rt.pauseMode === 'until-resume' || rt.pauseMode === 'application' || (rt.pauseMode === 'timed' && rt.pauseUntil > rt.now())
  }

  function getPrivacyState(): PrivacyState {
    refreshProtectedCounter()
    return { paused: isMonitoringPaused(), pauseUntil: rt.pauseUntil, pauseMode: rt.pauseMode, protectedToday: rt.protectedToday }
  }

  function emitPrivacyState() {
    rt.sendToRenderer('privacy-updated', getPrivacyState())
  }

  function pauseMonitoring(mode: number | 'until-resume' | 'application') {
    if (mode === 'until-resume') {
      rt.pauseMode = mode
      rt.pauseUntil = Number.MAX_SAFE_INTEGER
      rt.pausedWorkspace = ''
      rt.pausedApplicationKey = ''
    } else if (mode === 'application') {
      const target = services.foreground.getPauseTarget()
      if (!target) return pauseMonitoring('until-resume')
      rt.pauseMode = mode
      rt.pauseUntil = Number.MAX_SAFE_INTEGER
      rt.pausedWorkspace = target.workspace
      rt.pausedApplicationKey = target.applicationKey
    } else {
      rt.pauseMode = 'timed'
      rt.pauseUntil = rt.now() + mode * 60 * 1000
      rt.pausedWorkspace = ''
      rt.pausedApplicationKey = ''
    }
    services.tray.rebuildMenu()
    emitPrivacyState()
    services.foreground.refreshCadence()
    services.storage.scheduleSave()
  }

  function resumeMonitoring() {
    rt.pauseUntil = 0
    rt.pauseMode = null
    rt.pausedWorkspace = ''
    rt.pausedApplicationKey = ''
    services.tray.rebuildMenu()
    emitPrivacyState()
    services.foreground.refreshCadence()
    services.storage.scheduleSave()
  }

  // 初始化受保护日期（原模块顶层 getLocalDateKey() 副作用移到这里，随服务创建执行一次）。
  rt.protectedDate = getLocalDateKey()

  return {
    rebuildMatcher,
    matchesIgnoredPattern,
    refreshProtectedCounter,
    recordProtectedItem,
    isMonitoringPaused,
    getPrivacyState,
    emitPrivacyState,
    pauseMonitoring,
    resumeMonitoring,
  }
}
