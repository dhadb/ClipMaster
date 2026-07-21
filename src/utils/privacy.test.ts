import { describe, expect, it } from 'vitest'
import { isSensitiveClipboardContent, isValidChineseId, passesLuhnCheck } from './privacy'

describe('sensitive clipboard detection', () => {
  it('detects credentials and validated identity numbers', () => {
    expect(isSensitiveClipboardContent('password=hunter2')).toBe(true)
    expect(passesLuhnCheck('4111 1111 1111 1111')).toBe(true)
    expect(isSensitiveClipboardContent('Card 4111 1111 1111 1111')).toBe(true)
    expect(isValidChineseId('11010519491231002X')).toBe(true)
  })

  it('does not classify arbitrary long numbers as payment cards or IDs', () => {
    expect(isSensitiveClipboardContent('Order 1234567890123456')).toBe(false)
    expect(isSensitiveClipboardContent('Timestamp 20260721184400123')).toBe(false)
    expect(isValidChineseId('110105202613400021')).toBe(false)
  })
})
