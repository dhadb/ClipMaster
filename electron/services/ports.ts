/**
 * 可注入端口（P1-A 端口化）。
 *
 * 服务层的决策逻辑只依赖这里的接口；默认实现包装 electron / node 能力，
 * 由组合根（electron/main.ts）在启动时装配。测试可以注入假实现，
 * 不必启动 Electron 运行时。
 *
 * 约定：本文件及所有 service 文件不得在模块顶层执行任何 electron API
 * （仅函数体内使用），保证 vitest 可以安全 import 这些模块。
 */
import { app, clipboard, net, shell } from 'electron'
import { execFile } from 'child_process'
import * as nodeFs from 'fs'
import type { NativeImage } from 'electron'

// === Clock ===

export interface Clock {
  now(): number
}

export const systemClock: Clock = {
  now: () => Date.now(),
}

// === FileSystemPort ===

export interface FileStats {
  size: number
  isFile: () => boolean
  isDirectory: () => boolean
}

export interface WritableFileHandle {
  write(buffer: Buffer): Promise<void>
  close(): Promise<void>
}

export interface FileSystemPort {
  exists(path: string): boolean
  readFile(path: string): Buffer
  writeFile(path: string, data: Buffer | string): void
  rename(oldPath: string, newPath: string): void
  unlink(path: string): void
  readdir(path: string): string[]
  mkdirp(path: string): void
  stat(path: string): FileStats
  rm(path: string, options?: { force?: boolean }): void
  copyFile(from: string, to: string): void
  /** 真实路径解析（解析符号链接/大小写），失败时抛错，由调用方回退。 */
  realpathNative(path: string): string
  createReadStream(path: string): NodeJS.ReadableStream
  promises: {
    rm(path: string, options?: { force?: boolean }): Promise<void>
    rename(oldPath: string, newPath: string): Promise<void>
    open(path: string, flags: string): Promise<WritableFileHandle>
  }
}

export const nodeFileSystem: FileSystemPort = {
  exists: target => nodeFs.existsSync(target),
  readFile: target => nodeFs.readFileSync(target),
  writeFile: (target, data) => nodeFs.writeFileSync(target, data),
  rename: (oldPath, newPath) => nodeFs.renameSync(oldPath, newPath),
  unlink: target => nodeFs.unlinkSync(target),
  readdir: target => nodeFs.readdirSync(target),
  mkdirp: target => nodeFs.mkdirSync(target, { recursive: true }),
  stat: target => {
    const stat = nodeFs.statSync(target)
    return { size: stat.size, isFile: () => stat.isFile(), isDirectory: () => stat.isDirectory() }
  },
  rm: (target, options) => nodeFs.rmSync(target, { force: options?.force }),
  copyFile: (from, to) => nodeFs.copyFileSync(from, to),
  realpathNative: target => nodeFs.realpathSync.native(target),
  createReadStream: target => nodeFs.createReadStream(target),
  promises: {
    rm: async (target, options) => { await nodeFs.promises.rm(target, { force: options?.force }) },
    rename: async (oldPath, newPath) => { await nodeFs.promises.rename(oldPath, newPath) },
    open: async (target, flags) => {
      const handle = await nodeFs.promises.open(target, flags)
      return {
        write: async buffer => { await handle.write(buffer) },
        close: async () => { await handle.close() },
      }
    },
  },
}

// === ClipboardPort ===

export interface ClipboardContentInput {
  text?: string
  html?: string
  rtf?: string
}

export interface ClipboardPort {
  readText(): string
  readHtml(): string
  readRtf(): string
  has(format: string): boolean
  read(format: string): string
  readBuffer(format: string): Buffer
  readImage(): NativeImage
  writeText(text: string): void
  writeImage(image: NativeImage): void
  write(content: ClipboardContentInput): void
}

export const electronClipboard: ClipboardPort = {
  readText: () => clipboard.readText(),
  readHtml: () => clipboard.readHTML(),
  readRtf: () => clipboard.readRTF(),
  has: format => clipboard.has(format),
  read: format => clipboard.read(format),
  readBuffer: format => clipboard.readBuffer(format),
  readImage: () => clipboard.readImage(),
  writeText: text => clipboard.writeText(text),
  writeImage: image => clipboard.writeImage(image),
  write: content => clipboard.write(content),
}

// === HttpFetcher ===

export interface HttpFetcher {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

export const electronHttpFetcher: HttpFetcher = {
  fetch: (url, init) => net.fetch(url, init),
}

// === ShellPort ===

export interface ShellPort {
  openExternal(url: string): Promise<void>
  showItemInFolder(path: string): void
  /** 打开文件；返回空字符串表示成功，否则为错误信息。 */
  openPath(path: string): Promise<string>
}

export const electronShell: ShellPort = {
  openExternal: async url => { await shell.openExternal(url) },
  showItemInFolder: path => shell.showItemInFolder(path),
  openPath: async path => shell.openPath(path),
}

// === ForegroundDetector ===

export interface ForegroundTarget {
  hwnd: string
  processId: number
  processName: string
  applicationKey: string
  workspace: string
  capturedAt: number
}

export interface ForegroundDetector {
  /** 采样当前前台窗口；不可用/失败时返回 null。 */
  sample(): Promise<ForegroundTarget | null>
}

// === AppInfo ===

export interface AppInfoPort {
  getVersion(): string
  /** portable 安装场景下返回实际 exe 路径，否则返回 process.execPath。 */
  getExecutablePath(): string
  getPath(name: 'userData' | 'temp'): string
}

export const electronAppInfo: AppInfoPort = {
  getVersion: () => app.getVersion(),
  getExecutablePath: () => {
    const portableExecutable = process.env.PORTABLE_EXECUTABLE_FILE
    return portableExecutable && nodeFs.existsSync(portableExecutable) ? portableExecutable : process.execPath
  },
  getPath: name => app.getPath(name),
}

export { execFile }
