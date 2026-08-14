export interface ClipMasterRelease {
  latestVersion: string
  releaseUrl: string
}

export function parseReleaseChecksum(value: unknown, fileName: string): string | null {
  if (typeof value !== 'string' || typeof fileName !== 'string' || !fileName.trim()) return null
  const expectedName = fileName.trim()
  for (const line of value.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i)
    if (match?.[2].trim() === expectedName) return match[1].toLowerCase()
  }
  return null
}

const releasePathPattern = /^\/dhadb\/ClipMaster\/releases\/tag\/([^/]+)\/?$/i
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/

export function parseClipMasterReleaseUrl(value: unknown): ClipMasterRelease | null {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.username || url.password || url.port) return null

    const match = url.pathname.match(releasePathPattern)
    if (!match) return null

    const tag = decodeURIComponent(match[1])
    const latestVersion = tag.replace(/^v/i, '')
    if (!versionPattern.test(latestVersion)) return null

    url.search = ''
    url.hash = ''
    return { latestVersion, releaseUrl: url.toString() }
  } catch {
    return null
  }
}

export function parseClipMasterReleasePage(value: unknown): ClipMasterRelease | null {
  if (typeof value !== 'string') return null

  const metaTags = value.match(/<meta\b[^>]*>/gi) || []
  const releaseMeta = metaTags.find(tag => /\bproperty=["']og:url["']/i.test(tag))
  const content = releaseMeta?.match(/\bcontent=["']([^"']+)["']/i)?.[1]
  if (!content) return null

  try {
    return parseClipMasterReleaseUrl(new URL(content, 'https://github.com').toString())
  } catch {
    return null
  }
}
