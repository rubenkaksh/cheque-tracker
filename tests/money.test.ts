import { describe, expect, it } from 'vitest'
import { formatNpr, toPaisa } from '../src/lib/money'

describe('toPaisa', () => {
  it('parses plain digits with 0 decimals', () => {
    expect(toPaisa('250')).toBe(25000)
  })

  it('parses grouped digits (en-IN style commas)', () => {
    expect(toPaisa('1,00,000.50')).toBe(10000050)
    expect(toPaisa('4,27,93,187')).toBe(4279318700)
  })

  it('parses up to 2 decimals', () => {
    expect(toPaisa('0.5')).toBe(50)
    expect(toPaisa('99,999.99')).toBe(9999999)
  })

  it('throws on 3 decimals', () => {
    expect(() => toPaisa('1.234')).toThrow()
  })

  it('throws on negative input', () => {
    expect(() => toPaisa('-5')).toThrow()
  })

  it('throws on empty input', () => {
    expect(() => toPaisa('')).toThrow()
  })

  it('throws on letters', () => {
    expect(() => toPaisa('abc')).toThrow()
  })
})

describe('formatNpr', () => {
  it('formats with en-IN grouping and NPR prefix', () => {
    expect(formatNpr(4279318700)).toBe('NPR 4,27,93,187')
  })

  it('shows decimals only when paise is not zero', () => {
    expect(formatNpr(10000050)).toBe('NPR 1,00,000.50')
    expect(formatNpr(100)).toBe('NPR 1')
    expect(formatNpr(0)).toBe('NPR 0')
  })

  it('throws if not a safe integer', () => {
    expect(() => formatNpr(1.5)).toThrow()
    expect(() => formatNpr(Number.NaN)).toThrow()
  })
})

describe('round-trip', () => {
  it('formatNpr(toPaisa(x)) round-trips 99,999.99', () => {
    expect(formatNpr(toPaisa('99,999.99'))).toBe('NPR 99,999.99')
  })
})
