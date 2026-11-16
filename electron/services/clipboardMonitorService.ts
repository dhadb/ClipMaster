import { isTextWithinLimit } from '../../src/utils/limits'
import { matchesBlockedApplication } from '../../src/utils/applicationPrivacy'
import { getClipboardPrivacyScanText, isSensitiveClipboardContent } from '../../src/utils/privacy'
import { normalizeClipboardFilePaths, parseFileNameWBuffer, parseFileUriList } from '../../src/utils/fileClipboard'
import type { AppServices } from './index'

export interface ClipboardMonitorService {
  start(): void
  stop(): void
  scheduleRestart(delay?: number): void
}

export function createClipboardMonitorService(services: AppServices): ClipboardMonitorService {
  const rt = services.runtime
  const clipboard = services.clipboard

  function stop() {
    if (rt.clipboardWatcher) {
      clearInterval(rt.clipboardWatcher)
      rt.clipboardWatcher = null
    }
    if (rt.clipboardWatcherRestartTimer) {
      clearTimeout(rt.clipboardWatcherRestartTimer)
      rt.clipboardWatcherRestartTimer = null
    }
  }

  function scheduleRestart(delay = 5000) {
    if (rt.isQuitting || rt.clipboardWatcherRestartTimer) return
    if (rt.clipboardWatcher) {
      clearInterval(rt.clipboardWatcher)
      rt.clipboardWatcher = null
    }
    rt.clipboardWatcherRestartTimer = setTimeout(() => {
      rt.clipboardWatcherRestartTimer = null
      if (!rt.isQuitting) start()
    }, delay)
  }

  function start() {
    if (rt.clipboardWatcher || rt.isQuitting) return
    rt.clipboardWatcher = setInterval(() => {
      try {
        if (services.privacy.refreshProtectedCounter()) {
          services.privacy.emitPrivacyState()
          services.storage.scheduleSave()
        }
        if (rt.pauseMode === 'timed' && rt.pauseUntil > 0 && rt.pauseUntil <= rt.now()) services.privacy.resumeMonitoring()
        services.foreground.maybeResumeApplicationPause()
        // 错误计数器重置：如果连续成功，重置错误计数
        let hasError = false

        // 检查文本内容
        let currentContent = ''
        let currentHtml = ''
        let currentRtf = ''
        let currentFiles: string[] = []
        try {
          currentContent = clipboard.readText()
        } catch (readErr) {
          console.error('Failed to read clipboard text:', readErr)
          hasError = true
        }

        try { currentHtml = clipboard.readHtml() } catch { /* 无 HTML 内容：保持空串 */ }
        try { currentRtf = clipboard.readRtf() } catch { /* 无 RTF 内容：保持空串 */ }
        try {
          const fileNamePaths = clipboard.has('FileNameW') ? parseFileNameWBuffer(clipboard.readBuffer('FileNameW')) : []
          const uriPaths = clipboard.has('text/uri-list') ? parseFileUriList(clipboard.read('text/uri-list')) : []
          currentFiles = normalizeClipboardFilePaths([...fileNamePaths, ...uriPaths])
        } catch (fileErr) {
          console.error('Failed to read clipboard files:', fileErr)
        }
        if (!isTextWithinLimit(currentHtml)) currentHtml = ''
        if (!isTextWithinLimit(currentRtf)) currentRtf = ''
        if (currentFiles.length > 0) {
          currentContent = currentFiles.join('\n')
          currentHtml = ''
          currentRtf = ''
        }
        const clipboardFormatHash = services.history.getClipboardFormatHash(currentContent, currentHtml, currentRtf)

        if (services.privacy.isMonitoringPaused()) {
          rt.lastClipboardContent = currentContent
          rt.lastClipboardFormatHash = clipboardFormatHash
          if (rt.settings.recordImages && currentFiles.length === 0) {
            try { services.image.saveClipboardImage(false) } catch (imageErr) { console.error('Failed to baseline paused image:', imageErr) }
          }
          return
        }

        if (currentContent && currentContent !== rt.lastClipboardContent && !isTextWithinLimit(currentContent)) {
          rt.lastClipboardContent = currentContent
          rt.lastClipboardFormatHash = clipboardFormatHash
          currentContent = ''
          currentHtml = ''
          currentRtf = ''
        }

        if (matchesBlockedApplication(rt.settings.blockedApplications, services.foreground.getCachedApplication())) {
          let protectedClipboardChanged = false
          if ((currentContent || currentHtml || currentRtf) && clipboardFormatHash !== rt.lastClipboardFormatHash) {
            rt.lastClipboardContent = currentContent
            rt.lastClipboardFormatHash = clipboardFormatHash
            protectedClipboardChanged = true
          }
          if (rt.settings.recordImages && currentFiles.length === 0 && services.image.saveClipboardImage(false)) {
            rt.lastImageCheckAt = rt.now()
            protectedClipboardChanged = true
          }
          if (protectedClipboardChanged) services.privacy.recordProtectedItem()
          return
        }

        const privacyScanText = getClipboardPrivacyScanText(currentContent, currentHtml, currentRtf)

        if (privacyScanText && clipboardFormatHash !== rt.lastClipboardFormatHash && services.privacy.matchesIgnoredPattern(privacyScanText)) {
          rt.lastClipboardContent = currentContent
          rt.lastClipboardFormatHash = clipboardFormatHash
          services.privacy.recordProtectedItem()
          return
        }

        if (rt.settings.ignoreSensitive && privacyScanText && clipboardFormatHash !== rt.lastClipboardFormatHash && isSensitiveClipboardContent(privacyScanText, rt.settings.sensitiveRules)) {
          rt.lastClipboardContent = currentContent
          rt.lastClipboardFormatHash = clipboardFormatHash
          services.privacy.recordProtectedItem()
          return
        }

        // 检查图片内容
        let imageInfo: { path: string; hash: string } | null = null
        const shouldCheckImage = rt.now() - rt.lastImageCheckAt >= 2500
        if (rt.settings.recordImages && shouldCheckImage && currentFiles.length === 0) {
          rt.lastImageCheckAt = rt.now()
          try {
            imageInfo = services.image.saveClipboardImage()
          } catch (imgErr) {
            console.error('Failed to save clipboard image:', imgErr)
          }
        }

        // 处理文本内容
        if ((currentContent || currentHtml || currentRtf) && clipboardFormatHash !== rt.lastClipboardFormatHash) {
          rt.lastClipboardContent = currentContent
          rt.lastClipboardFormatHash = clipboardFormatHash

          const fileKey = currentFiles.join('\0')
          const existingIndex = rt.history.findIndex(item => item.content === currentContent && (item.html || '') === currentHtml && (item.rtf || '') === currentRtf && (item.files || []).join('\0') === fileKey)
          if (existingIndex !== -1) {
            const existing = rt.history.splice(existingIndex, 1)[0]
            services.history.recordItemCopy(existing)
            if (!existing.workspaceManual) existing.workspace = services.foreground.getCachedWorkspace() || existing.workspace
            existing.sourceApplication = services.foreground.getCachedApplication() || existing.sourceApplication
            existing.files = currentFiles.length > 0 ? currentFiles : undefined
            rt.history.unshift(existing)
          } else {
            const now = rt.now()
            rt.history.unshift({
              id: services.history.generateId(),
              content: currentContent,
              html: currentHtml || undefined,
              rtf: currentRtf || undefined,
              type: currentFiles.length > 0 ? 'file-list' : services.history.getClipboardContentType(currentContent),
              files: currentFiles.length > 0 ? currentFiles : undefined,
              timestamp: now,
              pinned: false,
              favorited: false,
              copyCount: 1,
              firstTimestamp: now,
              copyTimestamps: [now],
              workspace: services.foreground.getCachedWorkspace() || undefined,
              sourceApplication: services.foreground.getCachedApplication(),
            })
          }

          services.history.applyRetentionRules()
          rt.sendToRenderer('history-updated', rt.history)
          services.storage.scheduleSave()
        }

        // 处理图片内容
        if (imageInfo) {
          const existingIndex = rt.history.findIndex(item => item.type === 'image' && item.content === `[图片] ${imageInfo.hash}`)
          if (existingIndex !== -1) {
            const existing = rt.history.splice(existingIndex, 1)[0]
            services.history.recordItemCopy(existing)
            if (!existing.workspaceManual) existing.workspace = services.foreground.getCachedWorkspace() || existing.workspace
            existing.sourceApplication = services.foreground.getCachedApplication() || existing.sourceApplication
            existing.imagePath = imageInfo.path
            rt.history.unshift(existing)
          } else {
            const now = rt.now()
            rt.history.unshift({
              id: services.history.generateId(),
              content: `[图片] ${imageInfo.hash}`,
              type: 'image',
              timestamp: now,
              pinned: false,
              favorited: false,
              copyCount: 1,
              firstTimestamp: now,
              imagePath: imageInfo.path,
              copyTimestamps: [now],
              workspace: services.foreground.getCachedWorkspace() || undefined,
              sourceApplication: services.foreground.getCachedApplication(),
            })
          }
          services.history.applyRetentionRules()
          rt.sendToRenderer('history-updated', rt.history)
          services.storage.scheduleSave()
        }

        // 错误处理
        if (hasError) {
          rt.clipboardWatcherErrorCount++
          if (rt.clipboardWatcherErrorCount > 10) {
            console.error('Clipboard watcher error count exceeded, restarting...')
            rt.clipboardWatcherErrorCount = 0
            scheduleRestart()
          }
        } else {
          rt.clipboardWatcherErrorCount = 0
        }
      } catch (err) {
        console.error('Clipboard watcher failed:', err)
        rt.clipboardWatcherErrorCount++
        if (rt.clipboardWatcherErrorCount > 10) {
          console.error('Clipboard watcher critical error, restarting...')
          rt.clipboardWatcherErrorCount = 0
          scheduleRestart()
        }
      }
    }, 650)
  }

  return { start, stop, scheduleRestart }
}
