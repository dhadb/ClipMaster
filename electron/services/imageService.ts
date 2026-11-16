import { nativeImage, safeStorage } from 'electron'
import path from 'path'
import { createHash } from 'crypto'
import { getConstrainedImageSize } from '../../src/utils/imageLimits'
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, MAX_THUMBNAIL_BYTES, THUMBNAIL_EDGE } from '../../src/utils/limits'
import { isResolvedPathInside } from '../../src/utils/pathSafety'
import type { ImageCacheCleanupResult, ImageInfoPayload, ImagePayloadSize } from '../../shared/ipc-contract'
import type { AppServices } from './index'

// 图片落盘加密：复用主 JSON 的 safeStorage/DPAPI 思路，写前加密、读时解密。
// magic 前缀用于区分密文文件与历史明文文件（无前缀按明文读，向后兼容）。
const imageEncryptionMagic = Buffer.from('CMENC1', 'utf-8')

export interface SavedClipboardImage {
  path: string
  hash: string
}

export interface ImageService {
  resolveSafeImagePath(imagePath: string | undefined): string | null
  getThumbnailPath(imagePath: string): string
  ensureImageThumbnail(imagePath: string): string | null
  getSafeImageDataUrl(imagePath: string | undefined, size?: ImagePayloadSize): string | null
  getImageInfo(imagePath: string | undefined): ImageInfoPayload | null
  cleanupImageCache(): ImageCacheCleanupResult
  canShowFilePath(filePath: string): boolean
  safeDeleteImageFile(imagePath: string | undefined): void
  scheduleImageDelete(imagePath: string | undefined, delayMs: number): void
  cancelImageDelete(imagePath: string | undefined): void
  saveClipboardImage(persist?: boolean): SavedClipboardImage | null
  /** 读取（解密）图片字节；失败返回 null。 */
  readImageFile(dataPath: string): Buffer | null
  canOpenExternalUrl(url: string): boolean
}

export function createImageService(services: AppServices): ImageService {
  const rt = services.runtime
  const fs = rt.ports.fs

  function isImageEncryptionAvailable() {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  function encryptImageBuffer(buffer: Buffer): Buffer {
    if (!isImageEncryptionAvailable()) return buffer
    try {
      return Buffer.concat([imageEncryptionMagic, safeStorage.encryptString(buffer.toString('base64'))])
    } catch (err) {
      console.error('Failed to encrypt image, falling back to plain bytes:', err)
      return buffer
    }
  }

  /** 读取图片字节：带 magic 前缀的走 safeStorage 解密；解密失败按读取失败处理返回 null。 */
  function decryptImageBuffer(dataPath: string, raw: Buffer): Buffer | null {
    if (!raw.subarray(0, imageEncryptionMagic.length).equals(imageEncryptionMagic)) return raw
    if (!isImageEncryptionAvailable()) {
      console.error(`Encrypted image is unreadable on this device: ${dataPath}`)
      return null
    }
    try {
      return Buffer.from(safeStorage.decryptString(raw.subarray(imageEncryptionMagic.length)), 'base64')
    } catch (err) {
      console.error(`Failed to decrypt image: ${dataPath}`, err)
      return null
    }
  }

  function readImageFile(dataPath: string): Buffer | null {
    try {
      return decryptImageBuffer(dataPath, fs.readFile(dataPath))
    } catch (err) {
      console.error(`Failed to read image file: ${dataPath}`, err)
      return null
    }
  }

  function writeImageFile(dataPath: string, buffer: Buffer) {
    fs.writeFile(dataPath, encryptImageBuffer(buffer))
  }

  function resolveSafeImagePath(imagePath: string | undefined) {
    if (!imagePath) return null
    // 先做真实路径解析（解析符号链接/junction/大小写），再比较前缀，
    // 防止借目录链接绕过 imagesDir 边界。路径不存在时回退 path.resolve。
    const safeRealpath = (target: string) => {
      try {
        return fs.realpathNative(target)
      } catch {
        return path.resolve(target)
      }
    }
    const resolvedRoot = safeRealpath(rt.paths.imagesDir)
    const resolvedImagePath = safeRealpath(imagePath)
    return isResolvedPathInside(resolvedRoot, resolvedImagePath, path.sep, process.platform === 'win32') ? resolvedImagePath : null
  }

  function getThumbnailPath(imagePath: string) {
    const extension = path.extname(imagePath)
    return path.join(path.dirname(imagePath), `${path.basename(imagePath, extension)}.thumb.jpg`)
  }

  function ensureImageThumbnail(imagePath: string) {
    const thumbnailPath = getThumbnailPath(imagePath)
    if (fs.exists(thumbnailPath)) return thumbnailPath
    const imageBytes = readImageFile(imagePath)
    if (!imageBytes) return null
    const image = nativeImage.createFromBuffer(imageBytes)
    if (image.isEmpty()) return null
    const { width, height } = image.getSize()
    const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(width, height))
    const thumbnail = scale < 1
      ? image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: 'good' })
      : image
    const buffer = thumbnail.toJPEG(72)
    if (buffer.byteLength > MAX_THUMBNAIL_BYTES) return null
    writeImageFile(thumbnailPath, buffer)
    return thumbnailPath
  }

  function getSafeImageDataUrl(imagePath: string | undefined, size: 'thumb' | 'detail' = 'thumb') {
    if (!imagePath) return null
    try {
      const resolvedImagePath = resolveSafeImagePath(imagePath)
      if (!resolvedImagePath) return null
      if (!fs.exists(resolvedImagePath)) return null
      const dataPath = size === 'thumb' ? ensureImageThumbnail(resolvedImagePath) : resolvedImagePath
      if (!dataPath) return null
      const buffer = readImageFile(dataPath)
      if (!buffer) return null
      const maxBytes = size === 'thumb' ? MAX_THUMBNAIL_BYTES : MAX_IMAGE_BYTES
      if (buffer.byteLength > maxBytes) return null
      const mimeType = path.extname(dataPath).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png'
      return `data:${mimeType};base64,${buffer.toString('base64')}`
    } catch (err) {
      console.error('Failed to read image data url:', err)
      return null
    }
  }

  function getImageInfo(imagePath: string | undefined) {
    if (!imagePath) return null
    try {
      const resolvedImagePath = resolveSafeImagePath(imagePath)
      if (!resolvedImagePath) return null
      if (!fs.exists(resolvedImagePath)) return null
      const stat = fs.stat(resolvedImagePath)
      const imageBytes = readImageFile(resolvedImagePath)
      const image = imageBytes ? nativeImage.createFromBuffer(imageBytes) : nativeImage.createEmpty()
      const size = image.isEmpty() ? { width: 0, height: 0 } : image.getSize()
      return { bytes: stat.size, width: size.width, height: size.height }
    } catch (err) {
      console.error('Failed to read image info:', err)
      return null
    }
  }

  function cleanupImageCache() {
    try {
      if (!fs.exists(rt.paths.imagesDir)) return { deleted: 0, bytes: 0 }
      const used = new Set<string>()
      rt.history
        .map(item => resolveSafeImagePath(item.imagePath))
        .filter((imagePath): imagePath is string => Boolean(imagePath))
        .forEach(imagePath => {
          used.add(imagePath)
          used.add(getThumbnailPath(imagePath))
        })
      let deleted = 0
      let bytes = 0
      for (const fileName of fs.readdir(rt.paths.imagesDir)) {
        const filePath = path.resolve(rt.paths.imagesDir, fileName)
        if (!filePath.startsWith(path.resolve(rt.paths.imagesDir) + path.sep)) continue
        if (used.has(filePath)) continue
        const stat = fs.stat(filePath)
        if (!stat.isFile()) continue
        bytes += stat.size
        fs.unlink(filePath)
        deleted += 1
      }
      return { deleted, bytes }
    } catch (err) {
      console.error('Failed to cleanup image cache:', err)
      return { deleted: 0, bytes: 0 }
    }
  }

  function canShowFilePath(filePath: string) {
    const trimmed = filePath.trim()
    if (!/^(?:[a-z]:\\|\\\\|\/)[^<>:*?"|]+/i.test(trimmed)) return false
    // P2 收紧：仅允许打开历史条目 files 列表里记录的路径，或 imagesDir 内的文件。
    // 渲染端传来的路径可能与记录时大小写/分隔符不一致，统一按平台归一化后集合匹配。
    const normalizeForCompare = (value: string) => {
      const resolved = path.resolve(value.trim())
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved
    }
    const candidate = normalizeForCompare(filePath)
    const allowed = new Set<string>()
    for (const item of rt.history) {
      for (const recorded of item.files || []) allowed.add(normalizeForCompare(recorded))
    }
    if (allowed.has(candidate)) return true
    const safeImagePath = resolveSafeImagePath(filePath.trim())
    return safeImagePath !== null && fs.exists(safeImagePath)
  }

  function safeDeleteImageFile(imagePath: string | undefined) {
    if (!imagePath) return
    try {
      const resolvedImagePath = resolveSafeImagePath(imagePath)
      if (!resolvedImagePath) return
      if (rt.history.some(item => resolveSafeImagePath(item.imagePath) === resolvedImagePath)) return
      if (fs.exists(resolvedImagePath)) fs.unlink(resolvedImagePath)
      const thumbnailPath = getThumbnailPath(resolvedImagePath)
      if (fs.exists(thumbnailPath)) fs.unlink(thumbnailPath)
      const legacyThumbnailPath = path.join(path.dirname(resolvedImagePath), `${path.basename(resolvedImagePath, path.extname(resolvedImagePath))}.thumb.png`)
      if (fs.exists(legacyThumbnailPath)) fs.unlink(legacyThumbnailPath)
    } catch (err) {
      console.error('Failed to delete image file:', err)
    }
  }

  function scheduleImageDelete(imagePath: string | undefined, delayMs: number) {
    if (!imagePath) return
    const existing = rt.pendingImageDeletes.get(imagePath)
    if (existing) clearTimeout(existing)
    if (delayMs <= 0) {
      rt.pendingImageDeletes.delete(imagePath)
      safeDeleteImageFile(imagePath)
      return
    }
    const timer = setTimeout(() => {
      rt.pendingImageDeletes.delete(imagePath)
      safeDeleteImageFile(imagePath)
    }, delayMs)
    rt.pendingImageDeletes.set(imagePath, timer)
  }

  function cancelImageDelete(imagePath: string | undefined) {
    if (!imagePath) return
    const timer = rt.pendingImageDeletes.get(imagePath)
    if (!timer) return
    clearTimeout(timer)
    rt.pendingImageDeletes.delete(imagePath)
  }

  function saveClipboardImage(persist = true): SavedClipboardImage | null {
    try {
      let image = services.clipboard.readImage()
      if (image.isEmpty()) return null
      const originalSize = image.getSize()
      const constrainedSize = getConstrainedImageSize(originalSize.width, originalSize.height, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS)
      if (!constrainedSize) return null
      if (constrainedSize.width !== originalSize.width || constrainedSize.height !== originalSize.height) {
        image = image.resize({ ...constrainedSize, quality: 'good' })
      }

      let buffer = image.toPNG()
      for (let attempt = 0; buffer.byteLength > MAX_IMAGE_BYTES && attempt < 3; attempt += 1) {
        const currentSize = image.getSize()
        image = image.resize({
          width: Math.max(1, Math.round(currentSize.width * 0.72)),
          height: Math.max(1, Math.round(currentSize.height * 0.72)),
          quality: 'good',
        })
        buffer = image.toPNG()
      }
      if (buffer.byteLength > MAX_IMAGE_BYTES) return null
      const hash = createHash('sha256').update(buffer).digest('hex').substring(0, 24)

      // 检查是否重复
      if (hash === rt.lastClipboardImageHash) return null
      rt.lastClipboardImageHash = hash
      if (!persist) return { path: '', hash }

      const imagePath = path.join(rt.paths.imagesDir, `${hash}.png`)
      if (!fs.exists(imagePath)) writeImageFile(imagePath, buffer)
      ensureImageThumbnail(imagePath)
      return { path: imagePath, hash }
    } catch (err) {
      console.error('Failed to save clipboard image:', err)
      return null
    }
  }

  function canOpenExternalUrl(url: string) {
    return /^(?:https?:\/\/|mailto:)/i.test(url.trim())
  }

  return {
    resolveSafeImagePath,
    getThumbnailPath,
    ensureImageThumbnail,
    getSafeImageDataUrl,
    getImageInfo,
    cleanupImageCache,
    canShowFilePath,
    safeDeleteImageFile,
    scheduleImageDelete,
    cancelImageDelete,
    saveClipboardImage,
    readImageFile,
    canOpenExternalUrl,
  }
}
