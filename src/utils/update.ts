export interface ClipMasterRelease {
  latestVersion: string
  releaseUrl: string
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
