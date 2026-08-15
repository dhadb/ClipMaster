import { describe, expect, it } from 'vitest'
import { MAX_CLIPBOARD_FILES, normalizeClipboardFilePaths, parseFileNameWBuffer, parseFileUriList } from './fileClipboard'

describe('clipboard file parsing', () => {
  it('parses Windows FileNameW buffers and removes duplicates', () => {
    const utf16 = new Uint8Array(Buffer.from('C:\\Docs\\one.txt\0D:\\Media\\two.png\0c:\\docs\\ONE.txt\0\0', 'utf16le'))
    expect(parseFileNameWBuffer(utf16)).toEqual(['C:\\Docs\\one.txt', 'D:\\Media\\two.png'])
  })

  it('parses local and UNC file URIs while ignoring comments and web URLs', () => {
    expect(parseFileUriList('# files\r\nfile:///C:/Docs/hello%20world.txt\r\nfile://server/share/report.pdf\r\nhttps://example.com')).toEqual([
      'C:\\Docs\\hello world.txt',
      '\\\\server\\share\\report.pdf',
    ])
  })

  it('bounds and validates imported file paths', () => {
    const values = Array.from({ length: MAX_CLIPBOARD_FILES + 10 }, (_, index) => `C:\\Temp\\${index}.txt`)
    expect(normalizeClipboardFilePaths(values)).toHaveLength(MAX_CLIPBOARD_FILES)
    expect(normalizeClipboardFilePaths(['relative.txt', '/tmp/file.txt', 'C:/valid.txt'])).toEqual(['C:\\valid.txt'])
  })
})
