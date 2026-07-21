import { describe, expect, it } from 'vitest'
import { getConstrainedImageSize } from './imageLimits'

describe('image capture dimensions', () => {
  it('keeps small images unchanged', () => {
    expect(getConstrainedImageSize(1200, 800)).toEqual({ width: 1200, height: 800 })
  })

  it('constrains both edge length and total pixel count', () => {
    const size = getConstrainedImageSize(12000, 8000)
    expect(size).not.toBeNull()
    expect(Math.max(size!.width, size!.height)).toBeLessThanOrEqual(4096)
    expect(size!.width * size!.height).toBeLessThanOrEqual(12_000_000)
  })

  it('rejects invalid dimensions', () => {
    expect(getConstrainedImageSize(0, 100)).toBeNull()
    expect(getConstrainedImageSize(Number.NaN, 100)).toBeNull()
  })
})
