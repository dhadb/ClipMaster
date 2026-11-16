import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { createAppServices, type AppServices } from './index'

/**
 * 回归测试：createAppServices 不注入 fs 时必须回退到真实 Node fs 端口。
 * 此前回退值是空对象，导致图片预览/保存等全部文件系统操作运行时崩溃
 * （TypeError: r.exists is not a function），且单测因各自 mock fs 未能发现。
 */
describe('createAppServices 默认 fs 端口', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function createWithDefaults(): AppServices {
    const dir = mkdtempSync(join(tmpdir(), 'clipmaster-services-'))
    dirs.push(dir)
    return createAppServices({
      isDev: true,
      isPackaged: false,
      paths: {
        dataPath: join(dir, 'clipmaster-data.json'),
        backupPath: join(dir, 'clipmaster-data.json.bak'),
        imagesDir: join(dir, 'images'),
      },
    })
  }

  it('未注入 fs 时回退到真实 Node fs 端口（而非空对象）', () => {
    const services = createWithDefaults()
    expect(typeof services.runtime.ports.fs.exists).toBe('function')
    expect(typeof services.runtime.ports.fs.readFile).toBe('function')
    expect(typeof services.runtime.ports.fs.realpathNative).toBe('function')
  })

  it('图片服务可经默认 fs 端口完成写入与读取', () => {
    const services = createWithDefaults()
    const file = join(services.runtime.paths.imagesDir, 'probe.png')
    const payload = Buffer.from('probe-bytes')
    services.runtime.ports.fs.mkdirp(services.runtime.paths.imagesDir)
    services.runtime.ports.fs.writeFile(file, payload)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file).equals(payload)).toBe(true)
    expect(services.image.readImageFile(file)?.equals(payload)).toBe(true)
  })
})
