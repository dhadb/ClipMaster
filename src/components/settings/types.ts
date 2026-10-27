import type { Settings as ClipboardSettings } from '../../store/clipboardStore'
import type { useI18n } from '../../i18n'

/** i18n 翻译函数类型 */
export type TFunc = ReturnType<typeof useI18n>['t']

/** 设置更新函数类型（与 store.updateSettings 调用签名一致） */
export type UpdateFn = <K extends keyof ClipboardSettings>(key: K, val: ClipboardSettings[K]) => Promise<void>

/** 敏感规则开关更新函数 */
export type SensitiveRuleUpdater = (rule: keyof ClipboardSettings['sensitiveRules'], enabled: boolean) => void

export type HotkeySettingKey = 'hotkey' | 'searchHotkey' | 'clearHotkey'

export type DataSecurityStatus = { available: boolean; active: boolean; migrating: boolean } | null
