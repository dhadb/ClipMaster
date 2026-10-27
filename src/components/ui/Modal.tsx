import React, { useEffect, useRef } from 'react'

type PanelTag = 'div' | 'form'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** aria-labelledby 指向的标题元素 id */
  labelledBy: string
  children: React.ReactNode
  /** 面板根标签，默认 div；表单弹窗传 form */
  as?: PanelTag
  onSubmit?: () => void
  maxWidth?: string
  zIndex?: number
  blur?: number
  panelClassName?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * 对话框基座：统一处理 role/aria-modal/aria-labelledby、初始焦点、
 * Tab 焦点循环、Escape 关闭以及关闭后的焦点归还。
 */
const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  labelledBy,
  children,
  as = 'div',
  onSubmit,
  maxWidth = '28rem',
  zIndex = 60,
  blur = 10,
  panelClassName = '',
}) => {
  const panelRef = useRef<HTMLElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  // 在 effect 里同步最新回调，避免 render 期副作用（react-hooks/refs）
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusables = (): HTMLElement[] => {
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      )
    }

    // 初始焦点：显式 data-autofocus 优先，其次首个可聚焦元素，最后面板自身
    const initial = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? panel
    initial?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey) {
        if (active === first || !panel?.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel?.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const setPanelRef = (node: HTMLElement | null) => {
    panelRef.current = node
  }

  const panelProps = {
    ref: setPanelRef,
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': labelledBy,
    className: `w-full overflow-hidden rounded-lg detail-panel ${panelClassName}`.trim(),
    style: {
      maxWidth,
      background: 'var(--bg-app)',
      border: '1px solid var(--border-card)',
      boxShadow: 'var(--shadow-app)',
    },
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4 detail-backdrop"
      style={{
        zIndex,
        background: 'color-mix(in srgb, var(--bg-root) 76%, transparent)',
        backdropFilter: `blur(${blur}px)`,
      }}
    >
      {as === 'form' ? (
        <form
          {...panelProps}
          onSubmit={event => {
            event.preventDefault()
            onSubmit?.()
          }}
        >
          {children}
        </form>
      ) : (
        <div {...panelProps}>{children}</div>
      )}
    </div>
  )
}

export default Modal
