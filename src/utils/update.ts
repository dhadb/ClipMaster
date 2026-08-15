export interface ClipMasterRelease {
  latestVersion: string
  releaseUrl: string
}

export interface ClipMasterReleaseDetails extends ClipMasterRelease {
  releaseNotes: string
  publishedAt: string | null
}

export const MAX_RELEASE_NOTES_LENGTH = 20_000

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

export function normalizeReleaseNotes(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_RELEASE_NOTES_LENGTH)
}

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

export function parseClipMasterReleaseApiPayload(value: unknown): ClipMasterReleaseDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as { tag_name?: unknown; html_url?: unknown; body?: unknown; published_at?: unknown }
  const tagName = typeof payload.tag_name === 'string' ? payload.tag_name.trim() : ''
  const tagVersion = tagName.replace(/^v/i, '')
  if (!versionPattern.test(tagVersion)) return null

  const release = parseClipMasterReleaseUrl(payload.html_url)
  const releaseNotes = normalizeReleaseNotes(payload.body)
  if (!release || release.latestVersion !== tagVersion || releaseNotes === null) return null

  const publishedAt = typeof payload.published_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i.test(payload.published_at)
    && !Number.isNaN(Date.parse(payload.published_at))
    ? payload.published_at
    : null

  return { ...release, releaseNotes, publishedAt }
}
