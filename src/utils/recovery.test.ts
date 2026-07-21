import { describe, expect, it } from 'vitest'
import { parseJsonDocument, recoverWithBackup } from './recovery'

describe('recoverWithBackup', () => {
  it('accepts UTF-8 JSON files with a byte-order mark', () => {
    expect(parseJsonDocument<{ history: unknown[] }>('\uFEFF{"history":[]}')).toEqual({ history: [] })
  })

  it('falls back when primary persisted data is corrupt', () => {
    const result = recoverWithBackup(
      () => JSON.parse('{broken'),
      () => JSON.parse('{"history":[]}'),
    )
    expect(result.source).toBe('backup')
    expect(result.value).toEqual({ history: [] })
    expect(result.primaryError).toBeInstanceOf(SyntaxError)
  })

  it('reports no data when both copies are invalid', () => {
    const result = recoverWithBackup(
      () => { throw new Error('primary') },
      () => { throw new Error('backup') },
    )
    expect(result.source).toBe('none')
    expect(result.value).toBeNull()
    expect(result.backupError).toBeInstanceOf(Error)
  })
})
