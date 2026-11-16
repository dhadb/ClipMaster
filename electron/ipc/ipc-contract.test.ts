import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '../../shared/ipc-contract'
import { createRecordingBinder, type RecordingBinder } from './registry'
import { registerAllIpcHandlers } from './registerAllIpc'
import { createAppServices, type AppServices } from '../services'

/**
 * 更新域的 3 个通道在 electron/main.ts 直接用 ipcMain.handle 注册
 * （releaseSafetyContract.test 把更新链源码契约钉在 main.ts），
 * 其余通道一律经 IpcBinder 注册。这里合并两侧断言“契约通道全部已注册”。
 */
const UPDATE_CHANNELS_REGISTERED_IN_MAIN = ['check-for-updates', 'download-update', 'install-update'] as const

const mainSource = readFileSync(
  fileURLToPath(new URL('../main.ts', import.meta.url)),
  'utf8',
)

const TEST_PATHS = {
  dataPath: '/tmp/clipmaster-test/data.json',
  backupPath: '/tmp/clipmaster-test/data.json.bak',
  imagesDir: '/tmp/clipmaster-test/images',
}

function createTestServices(): AppServices {
  const services = createAppServices({
    isDev: true,
    isPackaged: false,
    paths: TEST_PATHS,
  })
  // storage 域的实现保留在 main.ts（源码契约测试钉在 main.ts），
  // 契约测试只验证“通道注册齐全”，这里补上最小假实现即可。
  services.storage = {
    isDataEncryptionAvailable: () => true,
    getStorageHealthSnapshot: () => ({
      recoveredFromBackup: false,
      loadFailed: false,
      corruptFilePath: null,
      trimmedOnSave: 0,
      lastError: null,
      encryption: 'unknown',
    }),
    loadData: () => undefined,
    saveData: () => undefined,
    scheduleSave: () => undefined,
    flushPendingSave: () => undefined,
    cleanupStaleTempFiles: () => undefined,
  }
  return services
}

function registerForTest(): { recording: RecordingBinder; services: AppServices } {
  const recording = createRecordingBinder()
  const services = createTestServices()
  registerAllIpcHandlers(recording.binder, services)
  return { recording, services }
}

function trustedEvent() {
  // isDev=true 的可信渲染端来源（见 runtime.assertTrustedRenderer）。
  return { senderFrame: { url: 'http://localhost:5173' } } as never
}

function untrustedEvent() {
  return { senderFrame: { url: 'file:///evil/unsafe.html' } } as never
}

/** 异步 handler 会把“不可信渲染端”变成 rejected promise；同步 handler 则直接 throw。 */
async function expectUntrustedRejection(handler: (event: never, ...args: never[]) => unknown, channel: string) {
  let caught: unknown
  let returnedPromise = false
  try {
    const result = handler(untrustedEvent())
    if (result instanceof Promise) {
      returnedPromise = true
      await result
    }
  } catch (err) {
    caught = err
  }
  const message = `channel ${channel} (async=${returnedPromise})`
  expect(caught instanceof Error, message).toBe(true)
  expect((caught as Error).message, message).toContain('Untrusted renderer')
}

describe('ipc contract', () => {
  it('has no duplicate channel names', () => {
    expect(new Set(IPC_CHANNELS).size).toBe(IPC_CHANNELS.length)
  })

  it('registers every contract channel on the main side, with no extras', () => {
    const { recording } = registerForTest()
    // 更新域 3 通道：直接断言 main.ts 源码中的 ipcMain.handle 注册。
    for (const channel of UPDATE_CHANNELS_REGISTERED_IN_MAIN) {
      expect(mainSource, channel).toContain(`ipcMain.handle('${channel}'`)
    }
    // 其余通道：经 IpcBinder 注册，逐一比对契约清单。
    const expectedBinderChannels = IPC_CHANNELS.filter(channel => !(UPDATE_CHANNELS_REGISTERED_IN_MAIN as readonly string[]).includes(channel))
    expect([...recording.channels].sort()).toEqual([...expectedBinderChannels].sort())
  })

  it('registers each binder channel exactly once', () => {
    const { recording } = registerForTest()
    expect(new Set(recording.channels).size).toBe(recording.channels.length)
  })

  it('wires get-history to the runtime history array', () => {
    const { recording, services } = registerForTest()
    const handler = recording.handlers.get('get-history')
    expect(handler).toBeDefined()
    expect(handler!(trustedEvent())).toBe(services.runtime.history)
  })

  it('rejects untrusted renderer frames on every registered channel', async () => {
    const { recording } = registerForTest()
    for (const [channel, handler] of recording.handlers) {
      await expectUntrustedRejection(handler, channel)
    }
    expect(recording.handlers.size).toBe(IPC_CHANNELS.length - UPDATE_CHANNELS_REGISTERED_IN_MAIN.length)
  })

  it('allows trusted renderer frames through to the domain services', () => {
    const { recording, services } = registerForTest()
    services.runtime.history.push({
      id: 'item-1',
      content: 'hello',
      type: 'text',
      timestamp: 1,
      pinned: false,
      favorited: false,
      copyCount: 1,
      firstTimestamp: 1,
      copyTimestamps: [1],
    })
    const handler = recording.handlers.get('get-history')
    const result = handler!(trustedEvent()) as typeof services.runtime.history
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('hello')
  })
})
