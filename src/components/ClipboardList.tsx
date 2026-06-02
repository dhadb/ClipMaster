import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import ClipboardItemCard from './ClipboardItemCard'
import { useClipboardStore } from '../store/clipboardStore'

const ITEM_H = 88
const OVERSCAN = 4

const ClipboardList: React.FC = () => {
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const selectedId = useClipboardStore(s => s.selectedId)
  const setSelectedId = useClipboardStore(s => s.setSelectedId)
  const copyItem = useClipboardStore(s => s.copyItem)
  const containerRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 20 })

  const totalH = filteredHistory.length * ITEM_H

  const updateRange = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const start = Math.max(0, Math.floor(el.scrollTop / ITEM_H) - OVERSCAN)
    const end = Math.min(filteredHistory.length, Math.ceil((el.scrollTop + el.clientHeight) / ITEM_H) + OVERSCAN)
    setRange(prev => {
      if (Math.abs(prev.start - start) < 3 && Math.abs(prev.end - end) < 3) return prev
      return { start, end }
    })
  }, [filteredHistory.length])

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

  // 键盘导航
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = filteredHistory.findIndex(i => i.id === selectedId)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = idx < filteredHistory.length - 1 ? idx + 1 : 0
        setSelectedId(filteredHistory[next]?.id || null)
        const el = containerRef.current
        if (el) {
          const top = next * ITEM_H
          if (top < el.scrollTop) el.scrollTop = top
          else if (top + ITEM_H > el.scrollTop + el.clientHeight) el.scrollTop = top - el.clientHeight + ITEM_H
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = idx > 0 ? idx - 1 : filteredHistory.length - 1
        setSelectedId(filteredHistory[prev]?.id || null)
        const el = containerRef.current
        if (el) {
          const top = prev * ITEM_H
          if (top < el.scrollTop) el.scrollTop = top
          else if (top + ITEM_H > el.scrollTop + el.clientHeight) el.scrollTop = top - el.clientHeight + ITEM_H
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
  }, [filteredHistory, selectedId, setSelectedId, copyItem])

  // Reset selection if selectedId is not in filteredHistory
  useEffect(() => {
    if (filteredHistory.length === 0) {
      setSelectedId(null)
    } else if (!selectedId || !filteredHistory.find(i => i.id === selectedId)) {
      setSelectedId(filteredHistory[0].id)
    }
  }, [filteredHistory, selectedId, setSelectedId])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-2 py-1.5" style={{ willChange: 'scroll-position' }}>
      <div style={{ height: totalH, position: 'relative' }}>
        <div style={{ position: 'absolute', top: range.start * ITEM_H, width: '100%' }}>
          {visible.map((item, i) => (
            <div
              key={item.id}
              id={`clip-${item.id}`}
              className="item-enter"
              style={{
                height: ITEM_H,
                paddingBottom: 6,
                animationDelay: `${Math.min(i * 15, 100)}ms`,
              }}
            >
              <ClipboardItemCard
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default React.memo(ClipboardList)
