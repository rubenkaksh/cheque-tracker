import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../src/lib/supabase', () => ({ getSupabase: () => ({ rpc }) }))

import { supabaseRepo } from '../src/data/chequeRepo'
import { makeFakeRepo } from './fakeRepo'

const input = {
  bankId: 'b1',
  party: 'Test Party',
  chequeNo: 'ABC1234',
  amountPaisa: 100000n,
  receivedDate: '2026-11-01',
  maturityDate: '2026-12-01',
  status: 'in_office' as const,
}

describe('supabaseRepo error mapping', () => {
  beforeEach(() => rpc.mockReset())

  it('keeps "duplicate" in the error when create_cheque reports one', async () => {
    rpc
      .mockResolvedValueOnce({ data: 'party-id', error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate cheque: same bank, cheque number and party already exists' } })
    await expect(supabaseRepo.addCheque(input)).rejects.toThrow(/duplicate/)
    expect(rpc.mock.calls[0][0]).toBe('upsert_party')
    expect(rpc.mock.calls[1][0]).toBe('create_cheque')
  })

  it('maps a stale version to a reload message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'stale version: cheque was changed by someone else (expected 1, found 2)' } })
    await expect(supabaseRepo.transitionCheque('id', 'pdc_hold', 1)).rejects.toThrow(/changed by someone else, reload/)
  })

  it('passes the version to transition_cheque', async () => {
    rpc.mockResolvedValueOnce({ data: 2, error: null })
    await supabaseRepo.transitionCheque('id', 'pdc_hold', 7)
    expect(rpc).toHaveBeenCalledWith('transition_cheque', { cheque_id: 'id', to_status: 'pdc_hold', expected_version: 7 })
  })
})

describe('fake repo', () => {
  it('blocks a duplicate', async () => {
    const r = makeFakeRepo()
    await r.addCheque(input)
    await expect(r.addCheque(input)).rejects.toThrow(/duplicate/)
  })
})
