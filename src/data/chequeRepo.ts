/** Supabase-backed cheque repository. Status changes only go through the transition_cheque RPC. */

import { getSupabase } from '../lib/supabase'
import type { ChequeStatus } from './transitions'

export interface Cheque {
  id: string
  bank: string
  party: string
  chequeNoNorm: string
  amountPaisa: bigint
  receivedDate: string
  maturityDate: string
  status: ChequeStatus
  agent?: string
  note?: string
  version: number
}

export interface Bank {
  id: string
  name: string
}

export interface Agent {
  id: string
  name: string
}

export interface NewCheque {
  bankId: string
  party: string
  chequeNo: string
  amountPaisa: bigint
  receivedDate: string
  maturityDate: string
  status: ChequeStatus
  agentId?: string | null
  note?: string
}

export interface ChequeRepo {
  listCheques(): Promise<Cheque[]>
  addCheque(input: NewCheque): Promise<void>
  transitionCheque(id: string, toStatus: ChequeStatus, version: number): Promise<void>
  listBanks(): Promise<Bank[]>
  listAgents(): Promise<Agent[]>
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

interface Row {
  id: string
  cheque_no_norm: string
  amount_paisa: number | string
  received_date: string
  maturity_date: string
  status: ChequeStatus
  note: string | null
  version: number
  agent_id: string | null
  banks: { name: string } | null
  parties: { name: string } | null
}

function fail(error: { message: string }): never {
  const m = error.message
  if (/stale version/i.test(m)) throw new Error('This cheque was changed by someone else, reload')
  throw new Error(m)
}

export const supabaseRepo: ChequeRepo = {
  async listCheques() {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('cheques')
      .select(
        'id, cheque_no_norm, amount_paisa, received_date, maturity_date, status, note, version, agent_id, banks(name), parties(name)',
      )
      .order('maturity_date', { ascending: true })
    if (error) fail(error)
    const rows = (data ?? []) as unknown as Row[]
    const agentIds = Array.from(new Set(rows.map((r) => r.agent_id).filter((x): x is string => !!x)))
    const names = new Map<string, string>()
    if (agentIds.length) {
      const { data: ps } = await sb.from('profiles').select('id, full_name').in('id', agentIds)
      for (const p of (ps ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name)
    }
    return rows.map((r) => ({
      id: r.id,
      bank: r.banks?.name ?? '',
      party: r.parties?.name ?? '',
      chequeNoNorm: r.cheque_no_norm,
      amountPaisa: BigInt(r.amount_paisa),
      receivedDate: r.received_date,
      maturityDate: r.maturity_date,
      status: r.status,
      agent: r.agent_id ? (names.get(r.agent_id) ?? undefined) : undefined,
      note: r.note ?? undefined,
      version: r.version,
    }))
  },

  async addCheque(input) {
    const sb = getSupabase()
    const party = await sb.rpc('upsert_party', { name: input.party })
    if (party.error) fail(party.error)
    const { error } = await sb.rpc('create_cheque', {
      party_id: party.data,
      bank_id: input.bankId,
      cheque_no: input.chequeNo,
      amount_paisa: input.amountPaisa.toString(),
      maturity_date: input.maturityDate,
      received_date: input.receivedDate,
      initial_status: input.status,
      agent_id: input.agentId ?? null,
      note: input.note ?? null,
    })
    if (error) fail(error)
  },

  async transitionCheque(id, toStatus, version) {
    const { error } = await getSupabase().rpc('transition_cheque', {
      cheque_id: id,
      to_status: toStatus,
      expected_version: version,
    })
    if (error) fail(error)
  },

  async listBanks() {
    const { data, error } = await getSupabase()
      .from('banks')
      .select('id, name')
      .eq('active', true)
      .order('name')
    if (error) fail(error)
    return (data ?? []) as Bank[]
  },

  async listAgents() {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'agent')
      .eq('active', true)
      .order('full_name')
    if (error) fail(error)
    return ((data ?? []) as { id: string; full_name: string }[]).map((p) => ({ id: p.id, name: p.full_name }))
  },
}

let active: ChequeRepo = supabaseRepo

/** Swap the repository (tests inject a fake). */
export function setRepo(r: ChequeRepo): void {
  active = r
}

export const listCheques = () => active.listCheques()
export const addCheque = (i: NewCheque) => active.addCheque(i)
export const transitionCheque = (id: string, to: ChequeStatus, version: number) =>
  active.transitionCheque(id, to, version)
export const listBanks = () => active.listBanks()
export const listAgents = () => active.listAgents()
