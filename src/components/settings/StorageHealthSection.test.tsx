// @vitest-environment jsdom
/**
 * 设置 → 存储 →「数据写入健康」卡片。
 *
 * 顶部提示条会被用户关掉，设置区是"之后还能回来看真相"的地方，所以这里单独锁：
 * 加载态、健康态、异常态各自渲染成什么，以及错误详情不被截断。
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StorageHealthSection from './StorageHealthSection'
import { translate } from '../../i18n'
import type { TFunc } from './types'
import type { StorageHealth } from '../../types/storageHealth'

const t: TFunc = (key, params) => translate('zh-CN', key, params)

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

describe('StorageHealthSection', () => {
  it('还没拿到快照时显示加载文案，而不是假装健康', () => {
    render(<StorageHealthSection health={null} t={t} />)

    expect(screen.getByText('数据写入健康')).toBeInTheDocument()
    expect(screen.getByText('正在读取本地数据状态…')).toBeInTheDocument()
    expect(screen.queryByText('本地数据写入正常')).not.toBeInTheDocument()
  })

  it('完全健康时给出正常说明', () => {
    render(<StorageHealthSection health={makeHealth()} t={t} />)

    expect(screen.getByText('本地数据写入正常')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-storage-health-recoveredFromBackup')).not.toBeInTheDocument()
  })

  it('从备份恢复时列出问题并展示被隔离的文件路径', () => {
    render(<StorageHealthSection health={makeHealth({
      recoveredFromBackup: true,
      corruptFilePath: 'clipmaster-data.json.corrupt-1',
    })} t={t} />)

    expect(screen.getByTestId('settings-storage-health-recoveredFromBackup')).toHaveTextContent('已从备份恢复')
    expect(screen.getByText('已隔离的损坏文件')).toBeInTheDocument()
    expect(screen.getByText('clipmaster-data.json.corrupt-1')).toBeInTheDocument()
  })

  it('裁剪过记录时给出条数，错误详情保留完整文本（不截断到提示条的长度）', () => {
    const longError = `EACCES: permission denied ${'y'.repeat(400)}`
    render(<StorageHealthSection health={makeHealth({ trimmedOnSave: 5, lastError: longError })} t={t} />)

    expect(screen.getByTestId('settings-storage-health-trimmed')).toHaveTextContent('保存时裁剪了 5 条记录')
    expect(screen.getByText(longError)).toBeInTheDocument()
  })
})
