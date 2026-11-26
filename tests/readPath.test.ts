import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}))

// Minimal chainable stand-in for the supabase query builder.
vi.mock('../src/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const result = { data: h.tables[table] ?? [], error: null }
      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => Promise.resolve(result),
        in: () => Promise.resolve(result),
      }
      return chain
    },
  }),
}))

import { supabaseRepo } from '../src/data/chequeRepo'

describe('supabaseRepo.listCheques read path', () => {
  it('maps joined bank/party rows and bigint paisa to the Cheque type', async () => {
    h.tables.cheques = [
      {
        id: 'c1',
        cheque_no_norm: 'ABC1234',
        amount_paisa: 9007199254740993, // beyond Number.MAX_SAFE_INTEGER
        received_date: '2026-11-01',
        maturity_date: '2026-12-01',
        status: 'with_agent',
        note: null,
        version: 3,
        agent_id: 'u1',
        banks: { name: 'Test Bank Himalaya' },
        parties: { name: 'Test Traders Pvt' },
      },
      {
        id: 'c2',
        cheque_no_norm: 'XYZ9999',
        amount_paisa: '12500000',
        received_date: '2026-11-02',
        maturity_date: '2026-11-30',
        status: 'in_office',
        note: 'call first',
        version: 1,
        agent_id: null,
        banks: null,
        parties: null,
      },
    ]
    h.tables.profiles = [{ id: 'u1', full_name: 'Test Agent A' }]

    const [a, b] = await supabaseRepo.listCheques()

    expect(a).toEqual({
      id: 'c1',
      bank: 'Test Bank Himalaya',
      party: 'Test Traders Pvt',
      chequeNoNorm: 'ABC1234',
      amountPaisa: BigInt(9007199254740993),
      receivedDate: '2026-11-01',
      maturityDate: '2026-12-01',
      status: 'with_agent',
      agent: 'Test Agent A',
      note: undefined,
      version: 3,
    })
    expect(typeof a.amountPaisa).toBe('bigint')
    expect(b.amountPaisa).toBe(12500000n)
    expect(b.agent).toBeUndefined()
    expect(b.note).toBe('call first')
    expect(b.bank).toBe('')
    expect(b.party).toBe('')
  })
})
