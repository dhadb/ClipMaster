// @vitest-environment jsdom
/**
 * 组件级集成守卫（QA）。目的不是测样式，而是把两类"静态扫描抓不到、只有真渲染才暴露"的缺陷变成红灯：
 *  1) 嵌套可交互元素（<button> 里套 <button>/<div role="menu"> 带 onClick）——React 会打印
 *     "validateDOMNesting(...): <button> cannot be a descendant of <button>"，同时外层点击会抢占内层点击，
 *     表现为「点复制却选中了整条」/「菜单按钮点不动」。jsx-a11y 6.10.2 没有 no-nested-interactive 规则，
 *     只能靠这里做运行时兜底（见 eslint.config.js 注释）。
 *  2) 操作菜单必须由真正的 <button> 承载（kbd 可聚焦 + aria-haspopup），否则键盘用户无法触达复制/收藏/删除。
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ClipboardItem } from '../store/clipboardStore'
import ClipboardItemCard from './ClipboardItemCard'

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    type: 'text',
    content: 'hello world',
    timestamp: Date.now(),
    pinned: false,
    favorited: false,
    tags: [],
    workspace: '',
    ...overrides,
  } as unknown as ClipboardItem
}

function renderCard(overrides: Partial<ComponentProps<typeof ClipboardItemCard>> = {}) {
  return render(
    <ClipboardItemCard
      item={makeItem()}
      isSelected={false}
      onSelect={() => {}}
      selectionMode={false}
      isChecked={false}
      onToggleSelection={() => {}}
      {...overrides}
    />,
  )
}

describe('ClipboardItemCard 交互结构（回归：嵌套可交互元素）', () => {
  it('never nests an interactive element inside another button', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderCard()

    expect(container.querySelectorAll('button button').length).toBe(0)
    expect(container.querySelectorAll('button [role="menu"]').length).toBe(0)

    const nestingWarnings = errorSpy.mock.calls.filter(call => {
      const text = call.map(String).join(' ')
      return text.includes('validateDOMNesting') || text.includes('cannot be a descendant')
    })
    expect(nestingWarnings.map(call => call.map(String).join(' '))).toEqual([])

    errorSpy.mockRestore()
  })

  it('renders the actions menu trigger as a keyboard-focusable button and opens on click', () => {
    renderCard()

    const trigger = screen.getByRole('button', { name: /more|更多|更多操作/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    // 原生 button 默认可聚焦；若被换成 div 承载点击，这里会变成 -1 而报红
    expect(trigger.tabIndex).toBeGreaterThanOrEqual(0)

    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
