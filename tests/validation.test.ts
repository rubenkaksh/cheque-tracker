import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chequeFormSchema, normaliseChequeNo } from '../src/lib/validation'

/** Fixed "today": 2026-11-25 in Asia/Kathmandu (UTC+05:45). */
const TODAY = '2026-11-25'

function valid(overrides: Record<string, unknown> = {}) {
  return {
    party: 'Test Party',
    bank: 'Test Bank',
    chequeNo: 'AB12CD34',
    amount: '1500.50',
    maturityDate: '2027-01-25',
    receivedDate: TODAY,
    status: 'pdc_hold',
    agentId: null,
    note: 'Test note',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-25T06:00:00+05:45'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('party', () => {
  it('passes with a non-empty party', () => {
    expect(chequeFormSchema.safeParse(valid({ party: 'Test Party' })).success).toBe(true)
  })

  it('fails when party is empty', () => {
    expect(chequeFormSchema.safeParse(valid({ party: '' })).success).toBe(false)
  })
})

describe('bank', () => {
  it('passes with a bank', () => {
    expect(chequeFormSchema.safeParse(valid({ bank: 'Test Bank' })).success).toBe(true)
  })

  it('fails when bank is missing', () => {
    expect(chequeFormSchema.safeParse(valid({ bank: '' })).success).toBe(false)
  })
})

describe('normaliseChequeNo', () => {
  it('trims, uppercases and strips spaces and dashes', () => {
    expect(normaliseChequeNo(' ab12-cd 34 ')).toBe('AB12CD34')
  })
})

describe('chequeNo', () => {
  it('passes an 8-character alphanumeric number after normalising', () => {
    expect(chequeFormSchema.safeParse(valid({ chequeNo: ' ab12-cd 34 ' })).success).toBe(true)
  })

  it('fails when the normalised number is shorter than 4 characters', () => {
    expect(chequeFormSchema.safeParse(valid({ chequeNo: 'AB1' })).success).toBe(false)
  })

  it('fails when the normalised number has symbols', () => {
    expect(chequeFormSchema.safeParse(valid({ chequeNo: 'AB!@#$' })).success).toBe(false)
  })
})

describe('amount', () => {
  it('passes a positive amount with 2 decimals', () => {
    expect(chequeFormSchema.safeParse(valid({ amount: '1500.50' })).success).toBe(true)
  })

  it('fails when amount is zero', () => {
    expect(chequeFormSchema.safeParse(valid({ amount: '0' })).success).toBe(false)
  })

  it('fails when amount has more than 2 decimals', () => {
    expect(chequeFormSchema.safeParse(valid({ amount: '1.234' })).success).toBe(false)
  })
})

describe('maturityDate', () => {
  it('passes exactly 12 months after the received date', () => {
    expect(chequeFormSchema.safeParse(valid({ maturityDate: '2027-11-25' })).success).toBe(true)
  })

  it('fails 12 months plus 1 day after the received date', () => {
    expect(chequeFormSchema.safeParse(valid({ maturityDate: '2027-11-26' })).success).toBe(false)
  })

  it('fails when maturity date is missing', () => {
    expect(chequeFormSchema.safeParse(valid({ maturityDate: '' })).success).toBe(false)
  })
})

describe('receivedDate', () => {
  it('passes when received date is today', () => {
    expect(chequeFormSchema.safeParse(valid({ receivedDate: TODAY })).success).toBe(true)
  })

  it('fails when received date is in the future', () => {
    expect(chequeFormSchema.safeParse(valid({ receivedDate: '2026-11-26' })).success).toBe(false)
  })
})

describe('agentId', () => {
  it('passes when status is with_agent and agent is set', () => {
    expect(
      chequeFormSchema.safeParse(valid({ status: 'with_agent', agentId: 'test-agent-1' })).success,
    ).toBe(true)
  })

  it('fails when status is with_agent and agent is missing', () => {
    expect(chequeFormSchema.safeParse(valid({ status: 'with_agent', agentId: null })).success).toBe(
      false,
    )
  })
})

describe('note', () => {
  it('passes a note of exactly 500 characters', () => {
    expect(chequeFormSchema.safeParse(valid({ note: 'a'.repeat(500) })).success).toBe(true)
  })

  it('fails a note of 501 characters', () => {
    expect(chequeFormSchema.safeParse(valid({ note: 'a'.repeat(501) })).success).toBe(false)
  })
})
