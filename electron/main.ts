import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { getUtf8ByteLength, getBoundedImportSource, MAX_PERSISTED_DATA_BYTES } from '../src/utils/limits'
import { parseJsonDocument, recoverWithBackup } from '../src/utils/recovery'
import { fitHistoryToBudget } from '../src/utils/persistBudget'
import { normalizeDailyCounter } from '../src/utils/dailyCounter'
import { compileIgnoredRules } from '../src/utils/ignoredRules'
import { compareVersions } from '../src/utils/version'
import { parseClipMasterReleaseApiPayload, parseClipMasterReleasePage, parseClipMasterReleaseUrl, parseReleaseChecksum } from '../src/utils/update'
import { createAppServices, type AppServices } from './services'
import { sanitizeSettings } from './services/settingsService'
import type { UpdateInfo } from '../shared/ipc-contract'
import type { StoragePaths, StorageService } from './services/runtime'
import { registerAllIpcHandlers } from './ipc/registerAllIpc'
import type { IpcBinder } from './ipc/registry'

// 单实例锁：拿不到锁说明已有实例在跑，直接退出。
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// P1-A 端口化：原先散落在模块顶层的 fs/app.getPath 副作用收敛到显式 initStorage()。
function initStorage(): StoragePaths {
  const dataPath = path.join(app.getPath('userData'), 'clipmaster-data.json')
  const backupPath = `${dataPath}.bak`
  const imagesDir = path.join(app.getPath('userData'), 'images')
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true })
  }
  return { dataPath, backupPath, imagesDir }
}

const paths = initStorage()

// 组合根：创建全部服务并按契约注册 IPC。
const services: AppServices = createAppServices({
  isDev,
  isPackaged: app.isPackaged,
  paths,
})

const rt = services.runtime

// ============================================================================
// 存储域（持久化 + 落盘健康）。保留在 main.ts：src/utils 的
// storageHealthContract.test 对本文件源码做字面契约断言（trimmedOnSave 的
// “最近一次落盘”语义等），该测试禁改，故此域不外移到 services。
// ============================================================================

interface AppData {
  schemaVersion?: number
  history: typeof rt.history
  settings: typeof rt.settings
  protectedToday?: number
  protectedDate?: string
  pauseUntil?: number
  pauseMode?: typeof rt.pauseMode
  pausedWorkspace?: string
  pausedApplicationKey?: string
}

const encryptedStorageFormat = 'clipmaster-encrypted-v1'

function isDataEncryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function serializePersistedData(data: AppData) {
  const plainText = JSON.stringify(data)
  if (!isDataEncryptionAvailable()) {
    rt.storageEncryptionState = 'plain'
    return plainText
  }
  const encrypted = safeStorage.encryptString(plainText).toString('base64')
  rt.storageEncryptionState = 'encrypted'
  return JSON.stringify({ format: encryptedStorageFormat, payload: encrypted })
}

function validatePersistedData(value: unknown): Partial<AppData> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Persisted data must be an object')
  const data = value as Partial<AppData>
  const schemaVersion = data.schemaVersion === undefined ? 1 : Number(data.schemaVersion)
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 2) throw new Error('Unsupported persisted data version')
  return data
}

function readPersistedData(filePath: string): Partial<AppData> {
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size > MAX_PERSISTED_DATA_BYTES) throw new Error('Persisted data file exceeds the safety limit')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const envelope = parseJsonDocument<Record<string, unknown>>(raw)
  if (envelope?.format === encryptedStorageFormat && typeof envelope.payload === 'string') {
    if (!isDataEncryptionAvailable()) throw new Error('Encrypted data is unavailable on this device')
    const decrypted = safeStorage.decryptString(Buffer.from(envelope.payload, 'base64'))
    if (Buffer.byteLength(decrypted, 'utf8') > MAX_PERSISTED_DATA_BYTES) throw new Error('Decrypted data exceeds the safety limit')
    rt.storageEncryptionState = 'encrypted'
    return validatePersistedData(parseJsonDocument<Partial<AppData>>(decrypted))
  }
  rt.storageEncryptionState = 'plain'
  return validatePersistedData(envelope)
}

function applyLoadedData(data: Partial<AppData>) {
  const schemaVersion = data.schemaVersion === undefined ? 1 : Number(data.schemaVersion)
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 2) throw new Error('Unsupported persisted data version')
  rt.history = getBoundedImportSource({ history: data.history })
    .map(item => services.history.sanitizeHistoryItem(item, true))
    .filter(Boolean) as typeof rt.history
  rt.settings = sanitizeSettings(data.settings)
  rt.ignoredRules = compileIgnoredRules(rt.settings.ignoredPatterns)
  services.privacy.rebuildMatcher()
  const dailyCounter = normalizeDailyCounter(data.protectedDate, data.protectedToday)
  rt.protectedDate = dailyCounter.date
  rt.protectedToday = dailyCounter.count
  const loadedPauseMode = data.pauseMode === 'timed' || data.pauseMode === 'until-resume' || data.pauseMode === 'application' ? data.pauseMode : null
  const loadedPauseUntil = Number(data.pauseUntil)
  rt.pauseMode = loadedPauseMode
  rt.pauseUntil = Number.isFinite(loadedPauseUntil) && loadedPauseUntil > 0 ? loadedPauseUntil : 0
  rt.pausedWorkspace = typeof data.pausedWorkspace === 'string' ? data.pausedWorkspace.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64) || '' : ''
  rt.pausedApplicationKey = typeof data.pausedApplicationKey === 'string'
    ? data.pausedApplicationKey.trim().toLowerCase().replace(/\.exe$/i, '').slice(0, 120)
    : ''
  if (rt.pauseMode === 'timed' && rt.pauseUntil <= Date.now()) {
    rt.pauseMode = null
    rt.pauseUntil = 0
    rt.pausedWorkspace = ''
    rt.pausedApplicationKey = ''
  }
  if (!rt.pauseMode) {
    rt.pauseUntil = 0
    rt.pausedApplicationKey = ''
  }
  services.history.applyRetentionRules()
}

// 明文 JSON 的预算：落盘前按未加密长度估算，预留 base64(≈1.34×) + 信封 + DPAPI 头部的膨胀空间。
// 留 1.4 倍余量，宁可提前裁剪也不能写出一个下次读不回来的文件。
const PLAINTEXT_PERSIST_BUDGET = Math.floor(MAX_PERSISTED_DATA_BYTES / 1.4)

/**
 * P0-1：历史上 saveData 完全不看体积，只在**读取**侧用 MAX_PERSISTED_DATA_BYTES 拒绝。
 * 一旦写出超限文件，下次启动 readPersistedData 抛错 → 回退 .bak → 本轮改动全丢 →
 * 之后每次保存都超限，永久写不进去。裁剪规则见 src/utils/persistBudget.ts（有单测）。
 */
function fitPersistedData(data: AppData): { data: AppData; dropped: number } {
  const result = fitHistoryToBudget(
    data.history,
    PLAINTEXT_PERSIST_BUDGET,
    items => getUtf8ByteLength(JSON.stringify({ ...data, history: items })),
  )
  if (result.dropped === 0) return { data, dropped: 0 }
  return { data: { ...data, history: result.items }, dropped: result.dropped }
}

function getStorageHealthSnapshot() {
  return { ...rt.storageHealth, encryption: rt.storageEncryptionState }
}

/**
 * 推送去重键：只看用户可见的那几个字段（裁剪条数 / 备份恢复 / 读取失败 / 最近错误）。
 * corruptFilePath 与 encryption 在保存周期内不变，不参与比较。
 */
function storageHealthSignature(health: typeof rt.storageHealth): string {
  return [
    health.trimmedOnSave,
    health.recoveredFromBackup ? 1 : 0,
    health.loadFailed ? 1 : 0,
    health.lastError ?? '',
  ].join('|')
}

/**
 * 保存结束后推送落盘健康变化（同一轮保存只发一次，由 saveData 的 finally 保证）。
 * saveData 在两种"窗口不可用"的时刻也会跑：启动期（loadData → scheduleSave，mainWindow 还是 null）
 * 和退出期（before-quit → flushPendingSave，webContents 可能已在销毁）。这两种情况下推送
 * 必须静默跳过——通知失败绝不能反过来把保存/退出流程搞挂。
 */
function emitStorageHealthIfChanged(before: string) {
  if (storageHealthSignature(rt.storageHealth) === before) return
  const win = rt.mainWindow
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
  try {
    win.webContents.send('storage-health-changed', getStorageHealthSnapshot())
  } catch (err) {
    console.error('Failed to push storage health:', err)
  }
}

function loadData() {
  const primaryExisted = fs.existsSync(paths.dataPath)
  const recovered = recoverWithBackup(
    () => fs.existsSync(paths.dataPath) ? readPersistedData(paths.dataPath) : null,
    () => fs.existsSync(paths.backupPath) ? readPersistedData(paths.backupPath) : null,
  )
  if (recovered.primaryError) console.error('Failed to load data:', recovered.primaryError)
  if (recovered.backupError) console.error('Failed to load backup data:', recovered.backupError)

  // P0-1 关键：只要主文件"存在却读不出来"，立刻改名隔离。
  // 否则 saveData() 的 copyFileSync 会把这个坏文件当成"新备份"，
  // 覆盖掉真正能救命的那份 .bak —— 主备同时报废，而用户零感知。
  if (primaryExisted && recovered.source !== 'primary') {
    try {
      const corruptPath = `${paths.dataPath}.corrupt-${Date.now()}`
      fs.renameSync(paths.dataPath, corruptPath)
      rt.storageHealth.corruptFilePath = corruptPath
      console.error('Quarantined unreadable data file:', corruptPath)
    } catch (err) {
      console.error('Failed to quarantine unreadable data file:', err)
    }
  }

  rt.storageHealth.recoveredFromBackup = recovered.source === 'backup'
  rt.storageHealth.loadFailed = recovered.source === 'none' && primaryExisted
  if (rt.storageHealth.recoveredFromBackup || rt.storageHealth.loadFailed) {
    rt.storageHealth.lastError = recovered.primaryError
      ? String(recovered.primaryError)
      : 'Clipboard history could not be loaded'
  }

  if (recovered.value) {
    applyLoadedData(recovered.value)
    if (rt.storageEncryptionState === 'plain' && isDataEncryptionAvailable()) scheduleSave()
    return
  }
  rt.ignoredRules = compileIgnoredRules(rt.settings.ignoredPatterns)
  services.privacy.rebuildMatcher()
  const dailyCounter = normalizeDailyCounter(undefined, undefined)
  rt.protectedDate = dailyCounter.date
  rt.protectedToday = dailyCounter.count
}

function saveData() {
  // 推送基线：保存前先记指纹，结束后只在这几项真的变了时推一次给渲染层。
  const healthBeforeSave = storageHealthSignature(rt.storageHealth)
  try {
    services.privacy.refreshProtectedCounter()
    const base: AppData = { schemaVersion: 2, history: rt.history, settings: rt.settings, protectedToday: rt.protectedToday, protectedDate: rt.protectedDate, pauseUntil: rt.pauseUntil, pauseMode: rt.pauseMode, pausedWorkspace: rt.pausedWorkspace, pausedApplicationKey: rt.pausedApplicationKey }
    const { data, dropped } = fitPersistedData(base)
    if (dropped > 0) {
      rt.history = data.history
      console.warn(`Persistence budget exceeded: dropped ${dropped} older history items`)
    }
    const serialized = serializePersistedData(data)
    // 硬校验：裁剪后仍超限（例如受保护条目太多）就报错跳过，不写一个读不回来的文件
    const bytes = getUtf8ByteLength(serialized)
    if (bytes > MAX_PERSISTED_DATA_BYTES) {
      throw new Error(`Refusing to persist ${bytes} bytes (limit ${MAX_PERSISTED_DATA_BYTES})`)
    }
    const tmpPath = `${paths.dataPath}.${process.pid}.tmp`
    fs.writeFileSync(tmpPath, serialized, 'utf-8')
    // 从 .bak 恢复那一轮，主文件已被隔离（不存在），天然不会污染备份；
    // 保留 recoveredFromBackup 判断作为双保险。
    if (fs.existsSync(paths.dataPath) && !rt.storageHealth.recoveredFromBackup) fs.copyFileSync(paths.dataPath, paths.backupPath)
    fs.renameSync(tmpPath, paths.dataPath)
    rt.storageHealth.recoveredFromBackup = false
    rt.storageHealth.loadFailed = false
    rt.storageHealth.lastError = null
    // 语义是"最近一次落盘裁剪了多少条"（文案：保存时裁剪了 N 条），不是自启动以来的累计值。
    // 与上面三个一次性字段同组重置：本次没裁剪就归零，"最后一次保存没有裁剪"才能重新出现。
    rt.storageHealth.trimmedOnSave = dropped
  } catch (err) {
    rt.storageHealth.lastError = String(err)
    console.error('Failed to save data:', err)
  } finally {
    emitStorageHealthIfChanged(healthBeforeSave)
  }
}

function scheduleSave() {
  if (rt.saveTimer) clearTimeout(rt.saveTimer)
  rt.saveTimer = setTimeout(() => {
    rt.saveTimer = null
    saveData()
  }, 1000)
}

function flushPendingSave() {
  if (rt.saveTimer) {
    clearTimeout(rt.saveTimer)
    rt.saveTimer = null
    saveData()
  }
}

/**
 * 清理数据目录与 imagesDir 下遗留的 *.tmp（saveData 原子写/图片处理中断留下的）。
 * 崩溃或强杀进程时 rename 不执行，残留文件会一直占空间。清理失败静默，不影响退出。
 */
function cleanupStaleTempFiles() {
  const directories = [path.dirname(paths.dataPath), paths.imagesDir]
  for (const dir of directories) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.tmp')) continue
        try {
          fs.rmSync(path.join(dir, entry), { force: true })
        } catch {
          // 被占用或无权限：跳过，不影响退出。
        }
      }
    } catch {
      // 目录不可读：跳过。
    }
  }
}

services.storage = {
  isDataEncryptionAvailable,
  getStorageHealthSnapshot,
  loadData,
  saveData,
  scheduleSave,
  flushPendingSave,
  cleanupStaleTempFiles,
} satisfies StorageService

// ============================================================================
// 更新域（check/download/install + 安装包清理）。保留在 main.ts：
// releaseSafetyContract.test 对本文件源码做字面契约断言（更新链 fail-closed），
// 该测试禁改，故此域不外移到 services。
// ============================================================================

const latestReleaseUrl = 'https://github.com/dhadb/ClipMaster/releases/latest'
const latestReleaseApiUrl = 'https://api.github.com/repos/dhadb/ClipMaster/releases/latest'
const maxUpdateDownloadBytes = 300 * 1024 * 1024
let updateCache: { checkedAt: number; info: UpdateInfo } | null = null
let downloadedInstallerPath: string | null = null
let downloadedInstallerVersion: string | null = null
// 下载时据此校验过 SHA256；安装前再算一遍比对，封住"下载完到点安装之间
// temp 目录里的安装包被替换"的路径（D-003：更新链 fail-closed）。
let downloadedInstallerHash: string | null = null
let updateDownloadPromise: Promise<{ version: string }> | null = null

function getUpdateDownloadUrl(version: string) {
  const encodedVersion = encodeURIComponent(version)
  return `https://github.com/dhadb/ClipMaster/releases/download/v${encodedVersion}/ClipMaster-Setup-${encodedVersion}.exe`
}

/**
 * 清理 %TEMP% 里残留的历史安装包（D-003 的技术债收口）。
 *
 * 每升级一个版本会留下一个 `ClipMaster-Setup-<version>.exe`（~114 MB）。
 * 安装成功后当前进程已经退出，没有"安装后钩子"可用，所以在下次启动时清掉旧包：
 * 此刻正在运行的进程已经从该 exe 启动完毕，删掉不会影响升级结果。
 * 清理属于卫生问题而非功能，任何失败一律静默——绝不能让清理把启动拖垮。
 */
function cleanupStaleInstallers() {
  const tempDir = app.getPath('temp')
  try {
    for (const entry of fs.readdirSync(tempDir)) {
      if (!/^ClipMaster-Setup-[\d.]+\.exe$/i.test(entry)) continue
      try {
        fs.rmSync(path.join(tempDir, entry), { force: true })
      } catch {
        // 正在被占用（例如用户此刻正打开着安装包）或无权限：跳过，下次再清。
      }
    }
  } catch {
    // %TEMP% 不可读：不值得打扰用户。
  }
}

function getUpdateChecksumsUrl(version: string) {
  const encodedVersion = encodeURIComponent(version)
  return `https://github.com/dhadb/ClipMaster/releases/download/v${encodedVersion}/checksums.sha256`
}

async function calculateFileSha256(filePath: string) {
  const hash = createHash('sha256')
  return new Promise<string>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function getExpectedUpdateHash(info: UpdateInfo, installerPath: string) {
  const response = await services.http.fetch(getUpdateChecksumsUrl(info.latestVersion), {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'text/plain',
      'User-Agent': `ClipMaster/${info.currentVersion}`,
    },
  })
  if (!response.ok) throw new Error(`Checksum request failed with status ${response.status}`)
  const fileName = path.basename(installerPath)
  const checksum = parseReleaseChecksum(await response.text(), fileName)
  if (!checksum) throw new Error(`Checksum for ${fileName} was not found`)
  return checksum
}

function emitUpdateDownloadProgress(progress: { receivedBytes: number; totalBytes: number | null; percent: number | null }) {
  rt.sendToRenderer('update-download-progress', progress)
}

async function downloadInstaller(info: UpdateInfo): Promise<{ version: string }> {
  const installerPath = path.join(app.getPath('temp'), `ClipMaster-Setup-${info.latestVersion}.exe`)
  const partialPath = `${installerPath}.download`
  const expectedHash = await getExpectedUpdateHash(info, installerPath)

  if (downloadedInstallerPath && downloadedInstallerVersion === info.latestVersion && fs.existsSync(downloadedInstallerPath)) {
    const cachedHash = await calculateFileSha256(downloadedInstallerPath)
    if (cachedHash !== expectedHash) {
      await fs.promises.rm(downloadedInstallerPath, { force: true })
      downloadedInstallerPath = null
      downloadedInstallerVersion = null
      downloadedInstallerHash = null
    } else {
      const cachedSize = fs.statSync(downloadedInstallerPath).size
      downloadedInstallerHash = expectedHash
      emitUpdateDownloadProgress({ receivedBytes: cachedSize, totalBytes: cachedSize, percent: 100 })
      return { version: info.latestVersion }
    }
  }

  await fs.promises.rm(partialPath, { force: true })
  emitUpdateDownloadProgress({ receivedBytes: 0, totalBytes: null, percent: null })

  const response = await services.http.fetch(info.downloadUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(5 * 60 * 1000),
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': `ClipMaster/${info.currentVersion}`,
    },
  })
  if (!response.ok) throw new Error(`Download request failed with status ${response.status}`)
  if (!response.body) throw new Error('Update download returned an empty response')

  const contentLength = Number(response.headers.get('content-length'))
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  if (totalBytes !== null && totalBytes > maxUpdateDownloadBytes) throw new Error('Update package is too large')

  let receivedBytes = 0
  const reader = response.body.getReader()
  const file = await fs.promises.open(partialPath, 'w')
  let downloadError: unknown = null
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      receivedBytes += value.byteLength
      if (receivedBytes > maxUpdateDownloadBytes) throw new Error('Update package is too large')
      await file.write(Buffer.from(value))
      const percent = totalBytes ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : null
      emitUpdateDownloadProgress({ receivedBytes, totalBytes, percent })
    }
  } catch (error) {
    downloadError = error
  } finally {
    await file.close()
    await reader.cancel().catch(() => undefined)
  }
  if (downloadError) {
    await fs.promises.rm(partialPath, { force: true })
    throw downloadError
  }

  if (receivedBytes === 0) throw new Error('Update download returned an empty file')
  await fs.promises.rm(installerPath, { force: true })
  await fs.promises.rename(partialPath, installerPath)
  const actualHash = await calculateFileSha256(installerPath)
  if (actualHash !== expectedHash) {
    await fs.promises.rm(installerPath, { force: true })
    throw new Error('Downloaded update failed checksum verification')
  }
  downloadedInstallerPath = installerPath
  downloadedInstallerVersion = info.latestVersion
  downloadedInstallerHash = expectedHash
  emitUpdateDownloadProgress({ receivedBytes, totalBytes: totalBytes || receivedBytes, percent: 100 })
  return { version: info.latestVersion }
}

async function checkForUpdates(force = false) {
  if (!force && updateCache && Date.now() - updateCache.checkedAt < 10 * 60 * 1000) return updateCache.info

  const currentVersion = app.getVersion()
  let info: UpdateInfo | null = null

  try {
    const response = await services.http.fetch(latestReleaseApiUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `ClipMaster/${currentVersion}`,
      },
    })
    if (response.ok) {
      const release = parseClipMasterReleaseApiPayload(await response.json())
      if (release) {
        info = {
          currentVersion,
          latestVersion: release.latestVersion,
          hasUpdate: compareVersions(release.latestVersion, currentVersion) > 0,
          releaseUrl: release.releaseUrl,
          downloadUrl: getUpdateDownloadUrl(release.latestVersion),
          releaseNotes: release.releaseNotes,
          publishedAt: release.publishedAt,
        }
      }
    }
  } catch {
    info = null
  }

  if (!info) {
    const response = await services.http.fetch(latestReleaseUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'text/html',
        'User-Agent': `ClipMaster/${currentVersion}`,
      },
    })
    if (!response.ok) throw new Error(`Update request failed with status ${response.status}`)

    const releasePage = await response.text()
    const release = parseClipMasterReleaseUrl(response.url) || parseClipMasterReleasePage(releasePage)
    if (!release) throw new Error('Update response did not resolve to a valid release')
    info = {
      currentVersion,
      latestVersion: release.latestVersion,
      hasUpdate: compareVersions(release.latestVersion, currentVersion) > 0,
      releaseUrl: release.releaseUrl,
      downloadUrl: getUpdateDownloadUrl(release.latestVersion),
      releaseNotes: '',
      publishedAt: null,
    }
  }
  updateCache = { checkedAt: Date.now(), info }
  return info
}

async function downloadUpdate(): Promise<{ version: string }> {
  const info = updateCache?.info
  if (!info?.hasUpdate) throw new Error('No update is available')
  if (!updateDownloadPromise) {
    updateDownloadPromise = downloadInstaller(info).finally(() => { updateDownloadPromise = null })
  }
  return updateDownloadPromise
}

// 更新域 IPC 直接注册在本文件：releaseSafetyContract.test 对 main.ts 源码做字面
// 契约断言（安装前复校 SHA256 的 fail-closed 顺序），该测试禁改，不能改为经 ipc/ 层转发。
ipcMain.handle('check-for-updates', async (event, force = false): Promise<UpdateInfo> => {
  rt.assertTrustedRenderer(event)
  return checkForUpdates(force)
})

ipcMain.handle('download-update', async event => {
  rt.assertTrustedRenderer(event)
  return downloadUpdate()
})

ipcMain.handle('install-update', async event => {
  rt.assertTrustedRenderer(event)
  if (!downloadedInstallerPath || !downloadedInstallerVersion || !downloadedInstallerHash || !fs.existsSync(downloadedInstallerPath)) {
    throw new Error('Update package has not been downloaded')
  }
  // D-003：安装前复校 SHA256。下载时的校验只覆盖"下载那一刻"，这里覆盖"点安装那一刻"。
  const actualHash = await calculateFileSha256(downloadedInstallerPath)
  if (actualHash !== downloadedInstallerHash) {
    await fs.promises.rm(downloadedInstallerPath, { force: true })
    downloadedInstallerPath = null
    downloadedInstallerVersion = null
    downloadedInstallerHash = null
    throw new Error('Update package failed checksum verification before install')
  }
  const openError = await shell.openPath(downloadedInstallerPath)
  if (openError) throw new Error(openError)
  rt.isQuitting = true
  flushPendingSave()
  services.monitor.stop()
  services.foreground.stopTracker()
  app.quit()
  return { version: downloadedInstallerVersion }
})

// IPC：按契约注册（通道与载荷见 shared/ipc-contract.ts）。
const ipcBinder: IpcBinder = {
  handle: (channel, handler) => {
    ipcMain.handle(channel, handler as (event: Parameters<typeof handler>[0], ...args: unknown[]) => unknown)
  },
}
registerAllIpcHandlers(ipcBinder, services)

// App lifecycle
if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    if (rt.mainWindow?.isMinimized()) rt.mainWindow.restore()
    void services.window.showWindow()
  })

  app.whenReady().then(() => {
    loadData()
    services.image.cleanupImageCache()
    cleanupStaleInstallers()
    services.settings.applyAutoStart()
    services.window.createWindow()
    services.tray.createTray()
    services.foreground.startTracker()
    services.monitor.start()
    services.hotkeys.register()
    rt.mainWindow?.once('ready-to-show', () => {
      void services.window.showWindow()
    })
  }).catch(err => {
    // 启动链路任何一步抛错都不能挂着无声白屏：记录后直接退出，让启动失败可见。
    console.error('App startup failed:', err)
    rt.storageHealth.lastError = `App startup failed: ${String(err)}`
    app.exit(1)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !rt.settings.minimizeToTray) app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) services.window.createWindow()
  })

  app.on('before-quit', () => {
    rt.isQuitting = true
    flushPendingSave()
    services.monitor.stop()
    services.foreground.stopTracker()
    services.hotkeys.unregister()
    rt.pendingImageDeletes.forEach(timer => clearTimeout(timer))
    rt.pendingImageDeletes.clear()
  })

  // 退出前清理本轮保存/导入产生的临时文件（P2 生命周期兜底）。
  app.on('will-quit', () => {
    cleanupStaleTempFiles()
  })
}

// 顶层兜底：未捕获异常先冲刷落盘再退出（状态尽量不丢）；未处理的 Promise 拒绝只记录不退出。
process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err)
  rt.storageHealth.lastError = `Uncaught exception: ${String(err)}`
  try {
    flushPendingSave()
  } catch (flushErr) {
    console.error('Failed to flush pending save during crash:', flushErr)
  }
  app.exit(1)
})

process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:', reason)
  rt.storageHealth.lastError = `Unhandled rejection: ${String(reason)}`
})
