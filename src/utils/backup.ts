export interface TextMetadataBackup<T, S> {
  format: 'clipmaster-text-metadata'
  version: '1.2'
  exportedAt: string
  imagesExcluded: number
  items: T[]
  settings: S
}

export function createTextMetadataBackup<T extends { type: string; imagePath?: string }, S>(items: T[], settings: S, exportedAt = new Date()): TextMetadataBackup<Omit<T, 'imagePath'>, S> {
  const textItems = items
    .filter(item => item.type !== 'image')
    .map(item => {
      const { imagePath: _imagePath, ...metadata } = item
      return metadata
    })
  return {
    format: 'clipmaster-text-metadata',
    version: '1.2',
    exportedAt: exportedAt.toISOString(),
    imagesExcluded: items.length - textItems.length,
    items: textItems,
    settings,
  }
}
