import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 落盘健康快照的字面契约（对应 QA 复验阻断项 B-1）。
 *
 * trimmedOnSave 的语义是"最近一次落盘裁剪了多少条"，UI 文案是
 * 「保存时裁剪了 N 条」/「最后一次保存没有裁剪」。如果主进程写成 `+=`，
 * 它会变成自启动以来的累计值：文案里的数字不对，且 ok 分支（okDesc）一旦
 * 被顶掉就再也不会回来。这里直接对主进程源码做回归守卫，防止改回累计语义。
 */
const mainSource = readFileSync(
  fileURLToPath(new URL('../../electron/main.ts', import.meta.url)),
  'utf8',
)

describe('saveData 的 trimmedOnSave 契约', () => {
  it('按"最近一次落盘"赋值，而不是累加', () => {
    expect(mainSource).toContain('storageHealth.trimmedOnSave = dropped')
    expect(mainSource).not.toMatch(/trimmedOnSave\s*\+=/)
  })

  it('与 recoveredFromBackup / loadFailed / lastError 在同一重置组', () => {
    const resetBlock = mainSource.slice(
      mainSource.indexOf('storageHealth.recoveredFromBackup = false'),
      mainSource.indexOf('storageHealth.trimmedOnSave = dropped') + 50,
    )
    expect(resetBlock).toContain('storageHealth.loadFailed = false')
    expect(resetBlock).toContain('storageHealth.lastError = null')
    expect(resetBlock).toContain('storageHealth.trimmedOnSave = dropped')
  })
})
