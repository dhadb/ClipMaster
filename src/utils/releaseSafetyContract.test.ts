import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 更新链的安全契约（D-003：fail-closed）。
 *
 * 三条必须一直成立：
 * 1. 拿不到 checksums.sha256 / 找不到对应文件 → 抛错，绝不"跳过校验继续装"；
 * 2. 下载完成后把校验过的 hash 记下来；
 * 3. 点安装时再算一遍并比对，封住"下载完到点安装之间安装包被换掉"的路径。
 *
 * 这里直接对主进程源码做守卫，因为这条链路跑的是真实网络 + 真实 exe，
 * 不适合在单测里拉起。
 */
const mainSource = readFileSync(
  fileURLToPath(new URL('../../electron/main.ts', import.meta.url)),
  'utf8',
)

describe('更新安装链 fail-closed 契约', () => {
  it('拿不到校验值就抛错，不降级为"跳过校验"', () => {
    expect(mainSource).toContain('if (!checksum) throw new Error(`Checksum for ${fileName} was not found`)')
    expect(mainSource).toMatch(/if \(!response\.ok\) throw new Error\(`Checksum request failed/)
  })

  it('下载成功/命中缓存时记录校验过的 hash', () => {
    const downloadBlock = mainSource.slice(
      mainSource.indexOf('async function downloadInstaller'),
      mainSource.indexOf("ipcMain.handle('check-for-updates'"),
    )
    expect(downloadBlock).toContain('downloadedInstallerHash = expectedHash')
    expect(downloadBlock).toContain('throw new Error(\'Downloaded update failed checksum verification\')')
  })

  it('点安装前复校 hash，不一致就删包并拒绝安装', () => {
    const installBlock = mainSource.slice(
      mainSource.indexOf("ipcMain.handle('install-update'"),
      mainSource.indexOf("ipcMain.handle('create-item'"),
    )
    expect(installBlock).toContain('await calculateFileSha256(downloadedInstallerPath)')
    expect(installBlock).toContain('if (actualHash !== downloadedInstallerHash)')
    expect(installBlock).toContain('Update package failed checksum verification before install')
    // 复校必须发生在打开安装包之前
    expect(installBlock.indexOf('actualHash !== downloadedInstallerHash'))
      .toBeLessThan(installBlock.indexOf('shell.openPath'))
  })

  it('启动时清理 %TEMP% 里残留的历史安装包', () => {
    expect(mainSource).toContain('function cleanupStaleInstallers()')
    expect(mainSource).toMatch(/\/\^ClipMaster-Setup-\[\\d\.\]\+\\\.exe\$\/i/)
    const readyBlock = mainSource.slice(mainSource.indexOf('app.whenReady()'))
    expect(readyBlock).toContain('cleanupStaleInstallers()')
  })
})
