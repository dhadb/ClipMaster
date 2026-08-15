export const clipboardTypes = [
  'text',
  'link',
  'email',
  'color',
  'number',
  'code',
  'long-text',
  'json',
  'markdown',
  'file-path',
  'file-list',
  'phone',
  'image',
] as const

export type ClipboardType = typeof clipboardTypes[number]

export interface ClipboardItem {
  id: string
  content: string
  html?: string
  rtf?: string
  type: ClipboardType
  timestamp: number
  pinned: boolean
  favorited: boolean
  copyCount: number
  firstTimestamp: number
  copyTimestamps?: number[]
  workspace?: string
  workspaceManual?: boolean
  sourceApplication?: string
  imagePath?: string
  files?: string[]
  tags?: string[]
}

export interface SavedFilter {
  id: string
  label: string
  query: string
  filterType: string | null
  timeFilter: 'all' | 'today' | 'week'
  sortMode: 'newest' | 'oldest' | 'most-used'
}
