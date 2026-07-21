export interface RecoveryResult<T> {
  value: T | null
  source: 'primary' | 'backup' | 'none'
  primaryError?: unknown
  backupError?: unknown
}

export function parseJsonDocument<T>(value: string): T {
  return JSON.parse(value.replace(/^\uFEFF/, '')) as T
}

export function recoverWithBackup<T>(readPrimary: () => T | null, readBackup: () => T | null): RecoveryResult<T> {
  try {
    const value = readPrimary()
    if (value !== null) return { value, source: 'primary' }
  } catch (primaryError) {
    try {
      const value = readBackup()
      return value === null
        ? { value: null, source: 'none', primaryError }
        : { value, source: 'backup', primaryError }
    } catch (backupError) {
      return { value: null, source: 'none', primaryError, backupError }
    }
  }

  try {
    const value = readBackup()
    return value === null ? { value: null, source: 'none' } : { value, source: 'backup' }
  } catch (backupError) {
    return { value: null, source: 'none', backupError }
  }
}
