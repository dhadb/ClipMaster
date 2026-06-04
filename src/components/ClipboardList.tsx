import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import ClipboardItemCard from './ClipboardItemCard'
import { useClipboardStore } from '../store/clipboardStore'

const ITEM_H = 84
const OVERSCAN = 5

const ClipboardList: React.FC = () => {
  const filteredHistory = useClipboardStore(s => s.filteredHistory)
  const selectedId = useClipboardStore(s => s.selectedId)
  const setSelectedId = useClipboardStore(s => s.setSelectedId)
  const copyItem = useClipboardStore(s => s.copyItem)
  const containerRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 24 })

  const listDensity = useClipboardStore(s => s.settings.listDensity)
  const itemH = listDensity === 'compact' ? 72 : listDensity === 'comfortable' ? 96 : ITEM_H
  const totalH = filteredHistory.length * itemH

  const scrollToIndex = useCallback((index: number) => {
    const el = containerRef.current
    if (!el || index < 0) return
    const top = index * itemH
    const bottom = top + itemH
    if (top < el.scrollTop) el.scrollTop = top
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
  }, [itemH])

  const updateRange = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const start = Math.max(0, Math.floor(el.scrollTop / itemH) - OVERSCAN)
    const visibleCount = Math.ceil(el.clientHeight / itemH) + OVERSCAN * 2
    const end = Math.min(filteredHistory.length, start + visibleCount)
    setRange(prev => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [filteredHistory.length, itemH])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateRange()
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        updateRange()
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [updateRange])

  useEffect(() => { updateRange() }, [filteredHistory.length, updateRange])

  const visible = useMemo(
    () => filteredHistory.slice(range.start, range.end),
    [filteredHistory, range.start, range.end]
  )

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
        scrollToIndex(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = idx > 0 ? idx - 1 : filteredHistory.length - 1
        setSelectedId(filteredHistory[prev]?.id || null)
        scrollToIndex(prev)
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
  }, [filteredHistory, selectedId, setSelectedId, copyItem, scrollToIndex])

  useEffect(() => {
    if (filteredHistory.length === 0) {
      setSelectedId(null)
    } else if (!selectedId || !filteredHistory.find(i => i.id === selectedId)) {
      setSelectedId(filteredHistory[0].id)
    }
  }, [filteredHistory, selectedId, setSelectedId])

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
        if (index < filteredHistory.length) copyItem(filteredHistory[index].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filteredHistory, copyItem])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-2 py-1" style={{ contain: 'layout paint' }}>
      <div style={{ height: totalH, position: 'relative' }}>
        {visible.map((item, i) => {
          const actualIndex = range.start + i
          const top = actualIndex * itemH
          return (
            <div
              key={item.id}
              id={`clip-${item.id}`}
              className={actualIndex < 8 ? 'item-enter' : ''}
              data-density={listDensity}
              style={{ position: 'absolute', top, left: 0, right: 0, height: itemH, animationDelay: actualIndex < 8 ? `${Math.min(actualIndex * 10, 60)}ms` : '0ms' }}
            >
              <ClipboardItemCard
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default React.memo(ClipboardList)
