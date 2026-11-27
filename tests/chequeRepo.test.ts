import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const invoke = vi.fn()
vi.mock('../src/lib/supabase', () => ({ getSupabase: () => ({ rpc, functions: { invoke } }) }))

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

  it('calls replace_cheque with version and new cheque number', async () => {
    rpc.mockResolvedValueOnce({ data: 'CHQ-2083-0002', error: null })
    await supabaseRepo.replaceCheque('id', 3, 'NEW1234', 'swap')
    expect(rpc).toHaveBeenCalledWith('replace_cheque', {
      cheque_id: 'id', expected_version: 3, new_cheque_no: 'NEW1234', note: 'swap',
    })
  })
})

describe('supabaseRepo edit calls', () => {
  beforeEach(() => {
    rpc.mockReset()
    invoke.mockReset()
  })

  it('calls update_cheque with a snake_case patch and returns the new version', async () => {
    rpc.mockResolvedValueOnce({ data: 4, error: null })
    const v = await supabaseRepo.updateCheque('id', 3, { chequeNo: 'ABC9999', amountPaisa: 250000n, note: null })
    expect(v).toBe(4)
    expect(rpc).toHaveBeenCalledWith('update_cheque', {
      cheque_id: 'id',
      expected_version: 3,
      patch: { cheque_no: 'ABC9999', amount_paisa: '250000', note: null },
    })
  })

  it('maps a stale update_cheque to the reload message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'stale version: cheque was changed by someone else' } })
    await expect(supabaseRepo.updateCheque('id', 1, { note: 'x' })).rejects.toThrow(/changed by someone else, reload/)
  })

  it('calls update_bank and update_party', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await supabaseRepo.updateBank('b1', { name: 'New', kind: 'saccos', active: false })
    await supabaseRepo.updateParty('p1', { name: 'P', phone: null })
    expect(rpc).toHaveBeenNthCalledWith(1, 'update_bank', { bank_id: 'b1', patch: { name: 'New', kind: 'saccos', active: false } })
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_party', { party_id: 'p1', patch: { name: 'P', phone: null } })
  })

  it('calls set_profile_active', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await supabaseRepo.setAgentActive('u1', false)
    expect(rpc).toHaveBeenCalledWith('set_profile_active', { profile_id: 'u1', active: false })
  })

  it('invokes admin-create-agent with snake_case body and defaults role to agent', async () => {
    invoke.mockResolvedValueOnce({ data: { id: 'u2', email: 'a@test.invalid', role: 'agent' }, error: null })
    const r = await supabaseRepo.createAgent({ email: 'a@test.invalid', password: 'longpassword1', fullName: 'A Person' })
    expect(r).toEqual({ id: 'u2', email: 'a@test.invalid', role: 'agent' })
    expect(invoke).toHaveBeenCalledWith('admin-create-agent', {
      body: { email: 'a@test.invalid', password: 'longpassword1', full_name: 'A Person', role: 'agent' },
    })
  })

  it('surfaces the edge function error message', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'admin only' }) } },
    })
    await expect(
      supabaseRepo.createAgent({ email: 'a@test.invalid', password: 'longpassword1', fullName: 'A Person' }),
    ).rejects.toThrow('admin only')
  })
})

describe('fake repo', () => {
  it('blocks a duplicate', async () => {
    const r = makeFakeRepo()
    await r.addCheque(input)
    await expect(r.addCheque(input)).rejects.toThrow(/duplicate/)
  })
})
