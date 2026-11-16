// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { translate, useI18n } from '../i18n'
import { useClipboardStore } from '../store/clipboardStore'
import TabBar from './TabBar'

function setLanguage(setting: 'zh-CN' | 'en-US') {
  useClipboardStore.setState(state => ({ settings: { ...state.settings, language: setting } }))
}

function makeTypeLabelProbe(): { getCurrent: (type: string) => string; jsx: ReactNode } {
  const ref = { current: (type: string) => type }
  function Probe() {
    const [, force] = useState(0)
    const { typeLabel, language } = useI18n()
    const mounted = useRef(false)
    // 语言或词典变化时刷新探针；重新渲染后 ref 始终指向当前语言的 typeLabel
    useEffect(() => {
      ref.current = typeLabel
      if (mounted.current) force(n => n + 1)
      mounted.current = true
    }, [typeLabel, language])
    return null
  }
  return { getCurrent: (type: string) => ref.current(type), jsx: <Probe /> }
}

describe('i18n 复数与 typeLabel 兜底', () => {
  it('英文按 count 选择复数变体', () => {
    expect(translate('en-US', 'toast.deleted', { count: 1 })).toBe('Deleted 1 record')
    expect(translate('en-US', 'toast.deleted', { count: 3 })).toBe('Deleted 3 records')
    expect(translate('en-US', 'item.chars', { count: 1 })).toBe('1 char')
    expect(translate('en-US', 'item.chars', { count: 12 })).toBe('12 chars')
  })

  it('中文不区分单复数', () => {
    expect(translate('zh-CN', 'toast.deleted', { count: 1 })).toBe('已删除 1 条记录')
    expect(translate('zh-CN', 'toast.deleted', { count: 3 })).toBe('已删除 3 条记录')
  })

  it('未知类型回退到通用文本类型文案', async () => {
    setLanguage('en-US')
    const probe = makeTypeLabelProbe()
    const { unmount } = render(probe.jsx)
    expect(probe.getCurrent('definitely-unknown-type')).toBe('Text')
    setLanguage('zh-CN')
    await waitFor(() => expect(probe.getCurrent('definitely-unknown-type')).toBe('文本'))
    unmount()
  })
})

describe('TabBar 更多操作菜单 aria', () => {
  beforeEach(() => {
    setLanguage('zh-CN')
  })

  it('菜单触发按钮带 aria-haspopup/aria-expanded 并随开合更新', () => {
    render(<TabBar />)
    const trigger = screen.getByRole('button', { name: '更多操作' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('打开菜单后焦点落在第一个菜单项', () => {
    render(<TabBar />)
    const trigger = screen.getByRole('button', { name: '更多操作' })
    fireEvent.click(trigger)
    const firstItem = screen.getAllByRole('menuitem')[0]
    expect(document.activeElement).toBe(firstItem)
  })
})
