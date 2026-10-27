// @vitest-environment jsdom
/**
 * 渲染断言（P0-1 验收项）：落盘异常必须在界面上"看得见"。
 *
 * 这里不测 IPC、不测样式，只锁死一件事——main.ts 的 StorageHealth 一旦变成
 * 异常值，顶部提示条必须真的把中文文案渲染出来（不是只写 console）：
 *  1) recoveredFromBackup=true → 显示「已从备份恢复」+ 被隔离文件路径；
 *  2) trimmedOnSave>0         → 显示「保存时裁剪了 N 条记录」并代入 count；
 *  3) 一切正常               → 提示条不存在，不占用窗口顶部空间。
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import StorageHealthBanner from './StorageHealthBanner'
import { useClipboardStore } from '../store/clipboardStore'
import type { StorageHealth } from '../types/storageHealth'

function makeHealth(overrides: Partial<StorageHealth> = {}): StorageHealth {
  return {
    recoveredFromBackup: false,
    loadFailed: false,
    corruptFilePath: null,
    trimmedOnSave: 0,
    lastError: null,
    encryption: 'encrypted',
    ...overrides,
  }
}

beforeEach(() => {
  // jsdom 的 navigator.language 是 en-US，会解析成英文；这里固定中文以断言真实文案。
  useClipboardStore.setState(state => ({ settings: { ...state.settings, language: 'zh-CN' } }))
})

describe('StorageHealthBanner 渲染', () => {
  it('recoveredFromBackup=true 时提示已从备份恢复，并暴露被隔离的损坏文件', () => {
    render(<StorageHealthBanner health={makeHealth({
      recoveredFromBackup: true,
      corruptFilePath: 'C:\\Users\\DELL\\AppData\\Roaming\\clipmaster\\clipmaster-data.json.corrupt-1',
      lastError: 'SyntaxError: Unexpected token < in JSON at position 0',
    })} />)

    expect(screen.getByTestId('storage-health-banner')).toBeInTheDocument()
    const issue = screen.getByTestId('storage-health-issue-recoveredFromBackup')
    expect(issue).toHaveTextContent('已从备份恢复')
    expect(issue).toHaveTextContent('最后一次改动可能缺失')
    expect(screen.getByTestId('storage-health-banner')).toHaveTextContent('已隔离的损坏文件')
    expect(screen.getByTestId('storage-health-last-error')).toHaveTextContent('SyntaxError')
  })

  it('trimmedOnSave>0 时提示裁剪条数，并代入真实 count', () => {
    render(<StorageHealthBanner health={makeHealth({ trimmedOnSave: 7 })} />)

    const issue = screen.getByTestId('storage-health-issue-trimmed')
    expect(issue).toHaveTextContent('保存时裁剪了 7 条记录')
    expect(issue).not.toHaveTextContent('{count}')
  })

  it('loadFailed=true 时以 danger 级提示主文件无法读取', () => {
    render(<StorageHealthBanner health={makeHealth({ loadFailed: true })} />)

    expect(screen.getByTestId('storage-health-issue-loadFailed')).toHaveTextContent('主数据文件无法读取')
    expect(screen.queryByTestId('storage-health-issue-recoveredFromBackup')).not.toBeInTheDocument()
  })

  it('加密不可用时提示明文落盘风险', () => {
    render(<StorageHealthBanner health={makeHealth({ encryption: 'plain' })} />)

    expect(screen.getByTestId('storage-health-issue-encryption')).toHaveTextContent('本地加密不可用')
  })

  it('一切正常（含加密已启用）时不渲染提示条', () => {
    render(<StorageHealthBanner health={makeHealth()} />)

    expect(screen.queryByTestId('storage-health-banner')).not.toBeInTheDocument()
  })

  it('关闭按钮可以收起提示', () => {
    render(<StorageHealthBanner health={makeHealth({ trimmedOnSave: 1 })} />)

    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }))
    expect(screen.queryByTestId('storage-health-banner')).not.toBeInTheDocument()
  })

  it('lastError 展开后才显示更长的错误详情', () => {
    const longError = `EACCES: permission denied ${'x'.repeat(200)}`
    render(<StorageHealthBanner health={makeHealth({ trimmedOnSave: 2, lastError: longError })} />)

    const toggle = screen.getByTestId('storage-health-last-error')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('展开')

    fireEvent.click(toggle)
    expect(screen.getByTestId('storage-health-last-error')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('storage-health-last-error')).toHaveTextContent('收起')
  })
})
