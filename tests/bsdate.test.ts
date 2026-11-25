import { describe, it, expect } from 'vitest'
import { bsToAd, adToBs, isValidBs, formatBs, todayKathmandu } from '../src/lib/bsdate'

describe('bsToAd', () => {
  it('converts BS 2083-08-05 to AD 2026-11-21', () => {
    expect(bsToAd(2083, 8, 5)).toBe('2026-11-21')
  })

  it('converts BS 2080-05-15 to AD 2023-09-01', () => {
    expect(bsToAd(2080, 5, 15)).toBe('2023-09-01')
  })

  it('throws RangeError for BS 2091-01-01 (out of supported range)', () => {
    expect(() => bsToAd(2091, 1, 1)).toThrow(RangeError)
  })

  it('round trips BS 2074-01-01', () => {
    const ad = bsToAd(2074, 1, 1)
    expect(adToBs(ad)).toEqual({ year: 2074, month: 1, day: 1 })
  })

  it('round trips BS 2090-12-30', () => {
    const ad = bsToAd(2090, 12, 30)
    expect(adToBs(ad)).toEqual({ year: 2090, month: 12, day: 30 })
  })
})

describe('adToBs', () => {
  it('converts AD 2026-11-21 to BS 2083-08-05', () => {
    expect(adToBs('2026-11-21')).toEqual({ year: 2083, month: 8, day: 5 })
  })
})

describe('isValidBs', () => {
  it('rejects month 13', () => {
    expect(isValidBs(2083, 13, 1)).toBe(false)
  })

  it('rejects day 40', () => {
    expect(isValidBs(2083, 8, 40)).toBe(false)
  })

  it('accepts BS 2083-08-05', () => {
    expect(isValidBs(2083, 8, 5)).toBe(true)
  })
})

describe('formatBs', () => {
  it('zero pads to YYYY-MM-DD', () => {
    expect(formatBs({ year: 2083, month: 8, day: 5 })).toBe('2083-08-05')
  })
})

describe('todayKathmandu', () => {
  it('rolls over to the next day at 19:00Z (00:45 Kathmandu)', () => {
    expect(todayKathmandu(new Date('2026-11-24T19:00:00Z'))).toBe('2026-11-25')
  })

  it('stays on the same day at 17:00Z', () => {
    expect(todayKathmandu(new Date('2026-11-24T17:00:00Z'))).toBe('2026-11-24')
  })
})
