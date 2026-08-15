export const MAX_TEXT_BYTES = 2 * 1024 * 1024
export const MAX_IMPORT_ITEMS = 5000
export const MAX_IMPORT_FILE_BYTES = 32 * 1024 * 1024
export const MAX_PERSISTED_DATA_BYTES = 96 * 1024 * 1024
export const MAX_HISTORY_TEXT_BYTES = 64 * 1024 * 1024

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 12_000_000
export const MAX_IMAGE_EDGE = 4096
export const MAX_THUMBNAIL_BYTES = 512 * 1024
export const THUMBNAIL_EDGE = 256

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function isTextWithinLimit(value: string): boolean {
  return getUtf8ByteLength(value) <= MAX_TEXT_BYTES
}

export function getBoundedImportSource(payload: unknown): unknown[] {
  const record = payload !== null && typeof payload === 'object' ? payload as Record<string, unknown> : null
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.history)
        ? record.history
        : []
  return source.slice(0, MAX_IMPORT_ITEMS)
}
