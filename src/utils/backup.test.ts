import { describe, expect, it } from 'vitest'
import { createTextMetadataBackup } from './backup'

describe('text metadata backup', () => {
  it('excludes image and local file records without leaking absolute paths', () => {
    const backup = createTextMetadataBackup([
      { id: 'text', type: 'text', content: 'hello', imagePath: 'C:\\private\\leak.png' },
      { id: 'image', type: 'image', content: '[image]', imagePath: 'C:\\private\\image.png' },
      { id: 'files', type: 'file-list', content: 'C:\\private\\report.pdf', files: ['C:\\private\\report.pdf'] },
    ], { theme: 'dark' }, new Date('2026-07-21T00:00:00.000Z'))
    expect(backup.imagesExcluded).toBe(1)
    expect(backup.localFileRecordsExcluded).toBe(1)
    expect(backup.items).toEqual([{ id: 'text', type: 'text', content: 'hello' }])
    expect(JSON.stringify(backup)).not.toContain('C:\\private')
  })
})
