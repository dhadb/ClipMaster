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

export interface ImportByteSizeInput {
  content?: unknown
  html?: unknown
  rtf?: unknown
}

/**
 * 导入历史聚合预算（P2）：单条文本有 MAX_TEXT_BYTES 上限，但 import-history 一次
 * 可带入数千条，单条校验相加仍可能超出落盘预算。导入前把所有条目的
 * text/html/rtf 字节数累计起来，超过 MAX_PERSISTED_DATA_BYTES 就整批拒绝。
 */
export function getImportedItemByteLength(item: ImportByteSizeInput): number {
  let total = 0
  if (typeof item.content === 'string') total += getUtf8ByteLength(item.content)
  if (typeof item.html === 'string') total += getUtf8ByteLength(item.html)
  if (typeof item.rtf === 'string') total += getUtf8ByteLength(item.rtf)
  return total
}

export function getImportedItemsTotalByteLength(items: ImportByteSizeInput[]): number {
  let total = 0
  for (const item of items) total += getImportedItemByteLength(item)
  return total
}

/** 聚合预算校验：返回 true 表示可导入，false 表示超出 MAX_PERSISTED_DATA_BYTES 需整批拒绝。 */
export function isImportedItemsWithinBudget(items: ImportByteSizeInput[]): boolean {
  return getImportedItemsTotalByteLength(items) <= MAX_PERSISTED_DATA_BYTES
}
