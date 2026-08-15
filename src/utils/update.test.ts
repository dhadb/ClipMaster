import { describe, expect, it } from 'vitest'
import { MAX_RELEASE_NOTES_LENGTH, normalizeReleaseNotes, parseClipMasterReleaseApiPayload, parseClipMasterReleasePage, parseClipMasterReleaseUrl, parseReleaseChecksum } from './update'

describe('parseReleaseChecksum', () => {
  it('finds the checksum for the requested release asset', () => {
    expect(parseReleaseChecksum('abc\n0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  *ClipMaster-Setup-2.0.0.exe', 'ClipMaster-Setup-2.0.0.exe')).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
  })

  it('rejects malformed or unrelated checksum entries', () => {
    expect(parseReleaseChecksum('0123  ClipMaster-Setup-2.0.0.exe', 'ClipMaster-Setup-2.0.0.exe')).toBeNull()
    expect(parseReleaseChecksum('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  other.exe', 'ClipMaster-Setup-2.0.0.exe')).toBeNull()
  })
})

describe('parseClipMasterReleaseUrl', () => {
  it('extracts stable and prerelease versions from ClipMaster release URLs', () => {
    expect(parseClipMasterReleaseUrl('https://github.com/dhadb/ClipMaster/releases/tag/v1.3.1')).toEqual({
      latestVersion: '1.3.1',
      releaseUrl: 'https://github.com/dhadb/ClipMaster/releases/tag/v1.3.1',
    })
    expect(parseClipMasterReleaseUrl('https://github.com/dhadb/ClipMaster/releases/tag/v2.0.0-beta.2')).toEqual({
      latestVersion: '2.0.0-beta.2',
      releaseUrl: 'https://github.com/dhadb/ClipMaster/releases/tag/v2.0.0-beta.2',
    })
  })

  it('rejects other repositories, protocols, and malformed versions', () => {
    expect(parseClipMasterReleaseUrl('https://github.com/other/ClipMaster/releases/tag/v1.3.1')).toBeNull()
    expect(parseClipMasterReleaseUrl('http://github.com/dhadb/ClipMaster/releases/tag/v1.3.1')).toBeNull()
    expect(parseClipMasterReleaseUrl('https://github.com/dhadb/ClipMaster/releases/tag/latest')).toBeNull()
    expect(parseClipMasterReleaseUrl('not a URL')).toBeNull()
  })
})

describe('parseClipMasterReleasePage', () => {
  it('extracts the release from GitHub metadata when Electron omits the response URL', () => {
    expect(parseClipMasterReleasePage('<html><head><meta property="og:url" content="/dhadb/ClipMaster/releases/tag/v1.3.0"></head></html>')).toEqual({
      latestVersion: '1.3.0',
      releaseUrl: 'https://github.com/dhadb/ClipMaster/releases/tag/v1.3.0',
    })
  })

  it('rejects unrelated or incomplete metadata', () => {
    expect(parseClipMasterReleasePage('<meta property="og:url" content="/other/ClipMaster/releases/tag/v9.0.0">')).toBeNull()
    expect(parseClipMasterReleasePage('<meta property="og:title" content="ClipMaster">')).toBeNull()
  })
})

describe('parseClipMasterReleaseApiPayload', () => {
  it('extracts validated release details from the GitHub API payload', () => {
    expect(parseClipMasterReleaseApiPayload({
      tag_name: 'v2.1.0',
      html_url: 'https://github.com/dhadb/ClipMaster/releases/tag/v2.1.0',
      body: '\r\n## Highlights\r\n- Faster updates\r\n',
      published_at: '2026-08-15T08:30:00Z',
    })).toEqual({
      latestVersion: '2.1.0',
      releaseUrl: 'https://github.com/dhadb/ClipMaster/releases/tag/v2.1.0',
      releaseNotes: '## Highlights\n- Faster updates',
      publishedAt: '2026-08-15T08:30:00Z',
    })
  })

  it('rejects untrusted, mismatched, and incomplete release payloads', () => {
    expect(parseClipMasterReleaseApiPayload({
      tag_name: 'v2.1.0',
      html_url: 'https://github.com/other/ClipMaster/releases/tag/v2.1.0',
      body: 'Notes',
    })).toBeNull()
    expect(parseClipMasterReleaseApiPayload({
      tag_name: 'v2.1.0',
      html_url: 'https://github.com/dhadb/ClipMaster/releases/tag/v2.1.1',
      body: 'Notes',
    })).toBeNull()
    expect(parseClipMasterReleaseApiPayload({
      tag_name: 'v2.1.0',
      html_url: 'https://github.com/dhadb/ClipMaster/releases/tag/v2.1.0',
      body: null,
    })).toBeNull()
  })
})

describe('normalizeReleaseNotes', () => {
  it('normalizes newlines and bounds the displayed release notes', () => {
    expect(normalizeReleaseNotes('  first\r\nsecond\rthird  ')).toBe('first\nsecond\nthird')
    expect(normalizeReleaseNotes('x'.repeat(MAX_RELEASE_NOTES_LENGTH + 1))).toHaveLength(MAX_RELEASE_NOTES_LENGTH)
  })
})
