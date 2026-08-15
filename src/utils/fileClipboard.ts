export const MAX_CLIPBOARD_FILES = 100
export const MAX_CLIPBOARD_FILE_PATH_LENGTH = 4_096

function normalizeWindowsPath(value: string): string | null {
  const normalized = value.replace(/\0/g, '').trim()
  if (!normalized || normalized.length > MAX_CLIPBOARD_FILE_PATH_LENGTH) return null
  if (/^[A-Za-z]:[\\/]/.test(normalized)) return normalized.replace(/\//g, '\\')
  if (/^\\\\[^\\]+\\[^\\]+/.test(normalized)) return normalized.replace(/\//g, '\\')
  return null
}

export function normalizeClipboardFilePaths(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const paths: string[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    const filePath = normalizeWindowsPath(value)
    if (!filePath) continue
    const key = filePath.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    paths.push(filePath)
    if (paths.length >= MAX_CLIPBOARD_FILES) break
  }
  return paths
}

export function parseFileNameWBuffer(value: unknown): string[] {
  if (!(value instanceof Uint8Array) || value.byteLength < 2) return []
  const evenLength = value.byteLength - (value.byteLength % 2)
  const text = new TextDecoder('utf-16le').decode(value.slice(0, evenLength))
  return normalizeClipboardFilePaths(text.split(/\0+/))
}

export function parseFileUriList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const paths: string[] = []
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    try {
      const url = new URL(line)
      if (url.protocol !== 'file:') continue
      const decodedPath = decodeURIComponent(url.pathname)
      if (url.hostname && url.hostname.toLowerCase() !== 'localhost') {
        paths.push(`\\\\${url.hostname}${decodedPath.replace(/\//g, '\\')}`)
      } else {
        paths.push(decodedPath.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\'))
      }
    } catch {
    }
  }
  return normalizeClipboardFilePaths(paths)
}
