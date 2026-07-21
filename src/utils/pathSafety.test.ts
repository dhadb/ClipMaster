import { describe, expect, it } from 'vitest'
import { isResolvedPathInside } from './pathSafety'

describe('isResolvedPathInside', () => {
  it('accepts descendants and rejects parent paths and prefix collisions', () => {
    const root = 'C:\\ClipMaster\\images'
    expect(isResolvedPathInside(root, 'C:\\ClipMaster\\images\\safe.png', '\\', true)).toBe(true)
    expect(isResolvedPathInside(root, 'C:\\ClipMaster\\secret.png', '\\', true)).toBe(false)
    expect(isResolvedPathInside(root, 'C:\\ClipMaster\\images-other\\secret.png', '\\', true)).toBe(false)
    expect(isResolvedPathInside(root, root, '\\', true)).toBe(false)
  })
})
