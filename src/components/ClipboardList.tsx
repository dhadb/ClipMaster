import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import ClipboardItemCard from './ClipboardItemCard'
import { useClipboardStore, ClipboardItem } from '../store/clipboardStore'

const DEFAULT_ITEM_H = 88
const OVERSCAN = 4

// 使用 Map 存储每个项目的实际高度
const itemHeightMap = new Map<string, number>()

interface MeasuredItemProps {
  item: ClipboardItem
  isSelected: boolean
  top: number
  animationDelay: string
  onSelect: () => void
  onHeightChange: (id: string, height: number) => void
}

const MeasuredItem: React.FC<MeasuredItemProps> = ({ item, isSelected, top, animationDelay, onSelect, onHeightChange }) => {
  const itemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = itemRef.current
    if (!el) return

    const reportHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height > 0) onHeightChange(item.id, height)
    }

    reportHeight()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reportHeight) : null
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [item.id, onHeightChange])

  return (
    <div
      id={`clip-${item.id}`}
      ref={itemRef}
      className="item-enter"
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        animationDelay,
      }}
    >
      <ClipboardItemCard
        item={item}
        isSelected={isSelected}
        onSelect={onSelect}
      />
    </div>
  )
}

const ClipboardList: React.FC = () => {
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const selectedId = useClipboardStore(s => s.selectedId)
  const setSelectedId = useClipboardStore(s => s.setSelectedId)
  const copyItem = useClipboardStore(s => s.copyItem)
  const containerRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 20 })
  const [, forceLayout] = useState(0)

  const onHeightChange = useCallback((id: string, height: number) => {
    const normalizedHeight = Math.max(DEFAULT_ITEM_H, height + 8)
    if (itemHeightMap.get(id) === normalizedHeight) return
    itemHeightMap.set(id, normalizedHeight)
    forceLayout(v => v + 1)
  }, [])

  // 计算每个项目的实际高度
  const getItemHeight = useCallback((id: string) => {
    return itemHeightMap.get(id) || DEFAULT_ITEM_H
  }, [])

  // 计算总高度（基于实际项目高度）
  const totalH = useMemo(() => {
    return filteredHistory.reduce((sum, item) => sum + getItemHeight(item.id), 0)
  }, [filteredHistory, getItemHeight])

  // 计算每个项目的偏移量
  const itemOffsets = useMemo(() => {
    const offsets: number[] = []
    let offset = 0
    for (const item of filteredHistory) {
      offsets.push(offset)
      offset += getItemHeight(item.id)
    }
    return offsets
  }, [filteredHistory, getItemHeight])

  const updateRange = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const scrollTop = el.scrollTop
    const clientHeight = el.clientHeight

    // 找到可见范围的起始索引
    let start = 0
    for (let i = 0; i < filteredHistory.length; i++) {
      if (itemOffsets[i] + getItemHeight(filteredHistory[i].id) > scrollTop) {
        start = i
        break
      }
    }

    // 找到可见范围的结束索引
    let end = filteredHistory.length
    for (let i = start; i < filteredHistory.length; i++) {
      if (itemOffsets[i] > scrollTop + clientHeight) {
        end = i
        break
      }
    }

    // 添加 overscan
    start = Math.max(0, start - OVERSCAN)
    end = Math.min(filteredHistory.length, end + OVERSCAN)

    setRange(prev => {
      if (Math.abs(prev.start - start) < 3 && Math.abs(prev.end - end) < 3) return prev
      return { start, end }
    })
  }, [filteredHistory, itemOffsets, getItemHeight])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateRange()
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => { updateRange(); ticking = false })
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [updateRange])

  useEffect(() => { updateRange() }, [filteredHistory.length, updateRange])

  const visible = useMemo(() =>
    filteredHistory.slice(range.start, range.end),
    [filteredHistory, range.start, range.end]
  )

  useEffect(() => {
    const currentIds = new Set(filteredHistory.map(item => item.id))
    for (const id of itemHeightMap.keys()) {
      if (!currentIds.has(id)) itemHeightMap.delete(id)
    }
  }, [filteredHistory])

  // 键盘导航
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditing = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
      if (isEditing) return

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && filteredHistory.length === 0) {
        e.preventDefault()
        setSelectedId(null)
        return
      }

      const idx = filteredHistory.findIndex(i => i.id === selectedId)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = idx < filteredHistory.length - 1 ? idx + 1 : 0
        setSelectedId(filteredHistory[next]?.id || null)
        const el = containerRef.current
        if (el) {
          const top = itemOffsets[next]
          if (top < el.scrollTop) el.scrollTop = top
          else if (top + getItemHeight(filteredHistory[next].id) > el.scrollTop + el.clientHeight) {
            el.scrollTop = top - el.clientHeight + getItemHeight(filteredHistory[next].id)
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = idx > 0 ? idx - 1 : filteredHistory.length - 1
        setSelectedId(filteredHistory[prev]?.id || null)
        const el = containerRef.current
        if (el) {
          const top = itemOffsets[prev]
          if (top < el.scrollTop) el.scrollTop = top
          else if (top + getItemHeight(filteredHistory[prev].id) > el.scrollTop + el.clientHeight) {
            el.scrollTop = top - el.clientHeight + getItemHeight(filteredHistory[prev].id)
          }
        }
      } else if (e.key === 'Enter' && selectedId) {
        e.preventDefault()
        copyItem(selectedId)
      } else if (e.key === 'Delete' && selectedId) {
        e.preventDefault()
        useClipboardStore.getState().deleteItem(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filteredHistory, selectedId, setSelectedId, copyItem, itemOffsets, getItemHeight])

  // Reset selection if selectedId is not in filteredHistory
  useEffect(() => {
    if (filteredHistory.length === 0) {
      setSelectedId(null)
    } else if (!selectedId || !filteredHistory.find(i => i.id === selectedId)) {
      setSelectedId(filteredHistory[0].id)
    }
  }, [filteredHistory, selectedId, setSelectedId])

  // 快速粘贴队列：按数字键 1-9 快速粘贴
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditing = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
      if (isEditing) return

      if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (index < filteredHistory.length) {
          copyItem(filteredHistory[index].id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filteredHistory, copyItem])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-2 py-1" style={{ willChange: 'scroll-position' }}>
      <div style={{ height: totalH, position: 'relative' }}>
        {visible.map((item, i) => {
          const actualIndex = range.start + i
          const top = itemOffsets[actualIndex]
          return (
            <MeasuredItem
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              top={top}
              animationDelay={`${Math.min(i * 12, 80)}ms`}
              onSelect={() => setSelectedId(item.id)}
              onHeightChange={onHeightChange}
            />
          )
        })}
      </div>
    </div>
  )
}

export default React.memo(ClipboardList)
