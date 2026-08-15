export interface TextMetadataBackup<T, S> {
  format: 'clipmaster-text-metadata'
  version: '1.3'
  exportedAt: string
  imagesExcluded: number
  localFileRecordsExcluded: number
  items: T[]
  settings: S
}

export function createTextMetadataBackup<T extends { type: string; imagePath?: string; files?: string[] }, S>(items: T[], settings: S, exportedAt = new Date()): TextMetadataBackup<Omit<T, 'imagePath' | 'files'>, S> {
  const textItems = items
    .filter(item => item.type !== 'image' && item.type !== 'file-list')
    .map(item => {
      const { imagePath: _imagePath, files: _files, ...metadata } = item
      return metadata
    })
  return {
    format: 'clipmaster-text-metadata',
    version: '1.3',
    exportedAt: exportedAt.toISOString(),
    imagesExcluded: items.filter(item => item.type === 'image').length,
    localFileRecordsExcluded: items.filter(item => item.type === 'file-list').length,
    items: textItems,
    settings,
  }
}
