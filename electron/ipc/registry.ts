import type { IpcMainInvokeEvent } from 'electron'
import type { IpcChannel, IpcContract } from '../../shared/ipc-contract'

/**
 * ipcMain.handle 的类型化抽象。ipc/ 目录只依赖该接口，不直接触达 electron，
 * 因此契约测试可以用记录器替身注册全部 handler，无需启动 Electron。
 */
export interface IpcBinder {
  handle<K extends IpcChannel>(
    channel: K,
    handler: (event: IpcMainInvokeEvent, ...args: IpcContract[K]['request']) => IpcContract[K]['response'] | Promise<IpcContract[K]['response']>,
  ): void
}

export interface RecordingBinder {
  binder: IpcBinder
  /** 按注册顺序记录的通道名。 */
  channels: IpcChannel[]
  /** channel -> handler（供测试直接调用 handler 验证行为）。 */
  handlers: Map<IpcChannel, (event: IpcMainInvokeEvent, ...args: never[]) => unknown>
}

/** 测试用：记录所有注册请求的绑定器。 */
export function createRecordingBinder(): RecordingBinder {
  const channels: IpcChannel[] = []
  const handlers = new Map<IpcChannel, (event: IpcMainInvokeEvent, ...args: never[]) => unknown>()
  return {
    channels,
    handlers,
    binder: {
      handle: (channel, handler) => {
        channels.push(channel)
        handlers.set(channel, handler as (event: IpcMainInvokeEvent, ...args: never[]) => unknown)
      },
    },
  }
}
