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
  agentId?: string
  note?: string
  /** Follow-up date (AD ISO), set on bounce / partial cash / by a remark. */
  nextActionDate?: string
  version: number
}

/** A follow-up remark (cheque_events row with payload kind = remark). */
export interface Remark {
  id: string
  at: string
  note: string
  author?: string
  nextActionDate?: string
}

export type BankKind = 'bank' | 'saccos'

export interface Bank {
  id: string
  name: string
  kind?: BankKind | null
  active?: boolean
}

export interface Party {
  id: string
  name: string
  phone?: string | null
  address?: string | null
}

export interface NewBank {
  name: string
  kind: BankKind
}

export interface NewParty {
  name: string
  phone?: string
  address?: string
}

/** Same normalisation as parties.name_norm: trim, collapse whitespace, lowercase. */
export function normaliseName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface Agent {
  id: string
  name: string
  active?: boolean
}

/** Editable cheque fields (update_cheque whitelist). null clears agentId / note. */
export interface ChequePatch {
  chequeNo?: string
  amountPaisa?: bigint
  bankId?: string
  partyId?: string
  receivedDate?: string
  maturityDate?: string
  agentId?: string | null
  note?: string | null
}

export interface BankPatch {
  name?: string
  kind?: BankKind
  active?: boolean
}

export interface PartyPatch {
  name?: string
  phone?: string | null
  address?: string | null
}

export interface NewAgent {
  email: string
  password: string
  fullName: string
  role?: 'agent' | 'admin'
}

export interface CreatedAgent {
  id: string
  email: string
  role: 'agent' | 'admin'
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

export type ReceiptMethod = 'cash' | 'bank_transfer'

export interface NewReceipt {
  chequeId: string
  amountPaisa: bigint
  method: ReceiptMethod
  receivedOn: string
  note?: string
}

/** One row of the allowed_transitions table (the DB is the source of truth). */
export interface AllowedTransition {
  from: ChequeStatus
  to: ChequeStatus
  role: 'admin' | 'agent'
}

export interface ChequeRepo {
  listCheques(): Promise<Cheque[]>
  addCheque(input: NewCheque): Promise<void>
  transitionCheque(id: string, toStatus: ChequeStatus, version: number): Promise<void>
  /** Active banks only, unless includeInactive is true. */
  listBanks(includeInactive?: boolean): Promise<Bank[]>
  /** Agents (role = agent); active ones only unless includeInactive is true. */
  listAgents(includeInactive?: boolean): Promise<Agent[]>
  listParties(): Promise<Party[]>
  addBank(input: NewBank): Promise<void>
  setBankActive(id: string, active: boolean): Promise<void>
  /** Throws on a duplicate (normalised) name; returns the new party id. */
  addParty(input: NewParty): Promise<string>
  /** All rows of allowed_transitions (callers filter by their role). */
  listAllowedTransitions(): Promise<AllowedTransition[]>
  /** Calls the record_receipt RPC (the only way to reach partial_cash / closed_full_cash). */
  recordReceipt(input: NewReceipt): Promise<void>
  /** Outstanding balance in paisa from the cheque_balance view. */
  getBalance(chequeId: string): Promise<bigint>
  /** Calls the replace_cheque RPC (admin only): old cheque -> replaced, new cheque for the balance. */
  replaceCheque(id: string, version: number, newChequeNo: string, note?: string): Promise<void>
  /** Admin only: update_cheque RPC (optimistic lock). Returns the new version. */
  updateCheque(id: string, version: number, patch: ChequePatch): Promise<number>
  /** Admin only: update_bank RPC. */
  updateBank(id: string, patch: BankPatch): Promise<void>
  /** Admin only: update_party RPC. */
  updateParty(id: string, patch: PartyPatch): Promise<void>
  /** Admin only: admin-create-agent edge function. The password is never returned. */
  createAgent(input: NewAgent): Promise<CreatedAgent>
  /** Admin only: set_profile_active RPC (an admin cannot deactivate themselves). */
  setAgentActive(id: string, active: boolean): Promise<void>
  /** add_remark RPC: admin on any cheque, agent on own. Optional follow-up date (AD ISO). */
  addRemark(chequeId: string, remark: string, nextActionDate?: string): Promise<void>
  /** Remarks for one cheque, newest first. */
  listRemarks(chequeId: string): Promise<Remark[]>
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
  next_action_date: string | null
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

/** Maps a ChequePatch to the snake_case jsonb the update_cheque RPC expects (only keys that are set). */
export function chequePatchToJson(p: ChequePatch): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  if (p.chequeNo !== undefined) o.cheque_no = p.chequeNo
  if (p.amountPaisa !== undefined) o.amount_paisa = p.amountPaisa.toString()
  if (p.bankId !== undefined) o.bank_id = p.bankId
  if (p.partyId !== undefined) o.party_id = p.partyId
  if (p.receivedDate !== undefined) o.received_date = p.receivedDate
  if (p.maturityDate !== undefined) o.maturity_date = p.maturityDate
  if (p.agentId !== undefined) o.agent_id = p.agentId
  if (p.note !== undefined) o.note = p.note
  return o
}

export const supabaseRepo: ChequeRepo = {
  async listCheques() {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('cheques')
      .select(
        'id, cheque_no_norm, amount_paisa, received_date, maturity_date, status, note, next_action_date, version, agent_id, banks(name), parties(name)',
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
      agentId: r.agent_id ?? undefined,
      note: r.note ?? undefined,
      nextActionDate: r.next_action_date ?? undefined,
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

  async replaceCheque(id, version, newChequeNo, note) {
    const { error } = await getSupabase().rpc('replace_cheque', {
      cheque_id: id,
      expected_version: version,
      new_cheque_no: newChequeNo,
      note: note ?? null,
    })
    if (error) fail(error)
  },

  async updateCheque(id, version, patch) {
    const { data, error } = await getSupabase().rpc('update_cheque', {
      cheque_id: id,
      expected_version: version,
      patch: chequePatchToJson(patch),
    })
    if (error) fail(error)
    return Number(data)
  },

  async updateBank(id, patch) {
    const { error } = await getSupabase().rpc('update_bank', { bank_id: id, patch })
    if (error) fail(error)
  },

  async updateParty(id, patch) {
    const { error } = await getSupabase().rpc('update_party', { party_id: id, patch })
    if (error) fail(error)
  },

  async createAgent(input) {
    const { data, error } = await getSupabase().functions.invoke('admin-create-agent', {
      body: {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        role: input.role ?? 'agent',
      },
    })
    if (error) {
      // FunctionsHttpError carries the Response in .context; surface the function's own message.
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
      let msg = error.message
      try {
        const body = await ctx?.json?.()
        if (body?.error) msg = body.error
      } catch {
        /* keep the generic message */
      }
      throw new Error(msg)
    }
    return data as CreatedAgent
  },

  async setAgentActive(id, active) {
    const { error } = await getSupabase().rpc('set_profile_active', { profile_id: id, active })
    if (error) fail(error)
  },

  async listBanks(includeInactive = false) {
    let q = getSupabase().from('banks').select('id, name, kind, active').order('name')
    if (!includeInactive) q = q.eq('active', true)
    const { data, error } = await q
    if (error) fail(error)
    return (data ?? []) as Bank[]
  },

  async listParties() {
    const { data, error } = await getSupabase()
      .from('parties')
      .select('id, name, phone, address')
      .order('name')
    if (error) fail(error)
    return (data ?? []) as Party[]
  },

  async addBank(input) {
    const name = input.name.trim()
    const existing = await this.listBanks(true)
    if (existing.some((b) => normaliseName(b.name) === normaliseName(name))) {
      throw new Error(`Duplicate bank: "${name}" already exists`)
    }
    const { error } = await getSupabase().from('banks').insert({ name, kind: input.kind })
    if (error) {
      if (/duplicate key/i.test(error.message)) throw new Error(`Duplicate bank: "${name}" already exists`)
      fail(error)
    }
  },

  async setBankActive(id, active) {
    const { error } = await getSupabase().from('banks').update({ active }).eq('id', id)
    if (error) fail(error)
  },

  async addParty(input) {
    const name = input.name.trim()
    const existing = await this.listParties()
    if (existing.some((p) => normaliseName(p.name) === normaliseName(name))) {
      throw new Error(`Duplicate party: "${name}" already exists (names are compared ignoring case and extra spaces)`)
    }
    const { data, error } = await getSupabase().rpc('upsert_party', {
      name,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
    })
    if (error) fail(error)
    return data as string
  },

  async listAllowedTransitions() {
    const { data, error } = await getSupabase()
      .from('allowed_transitions')
      .select('from_status, to_status, role')
    if (error) fail(error)
    return ((data ?? []) as { from_status: ChequeStatus; to_status: ChequeStatus; role: 'admin' | 'agent' }[]).map(
      (r) => ({ from: r.from_status, to: r.to_status, role: r.role }),
    )
  },

  async recordReceipt(input) {
    const { error } = await getSupabase().rpc('record_receipt', {
      cheque_id: input.chequeId,
      amount_paisa: input.amountPaisa.toString(),
      method: input.method,
      received_on: input.receivedOn,
      note: input.note ?? null,
    })
    if (error) fail(error)
  },

  async getBalance(chequeId) {
    const { data, error } = await getSupabase()
      .from('cheque_balance')
      .select('balance_paisa')
      .eq('cheque_id', chequeId)
      .maybeSingle()
    if (error) fail(error)
    return BigInt((data as { balance_paisa: number | string } | null)?.balance_paisa ?? 0)
  },

  async addRemark(chequeId, remark, nextActionDate) {
    const { error } = await getSupabase().rpc('add_remark', {
      cheque_id: chequeId,
      remark,
      next_action_date: nextActionDate ?? null,
    })
    if (error) fail(error)
  },

  async listRemarks(chequeId) {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('cheque_events')
      .select('id, at, note, actor_id, payload')
      .eq('cheque_id', chequeId)
      .eq('payload->>kind', 'remark')
      .order('at', { ascending: false })
    if (error) fail(error)
    const rows = (data ?? []) as {
      id: number | string
      at: string
      note: string | null
      actor_id: string | null
      payload: { next_action_date?: string | null } | null
    }[]
    const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x)))
    const names = new Map<string, string>()
    if (ids.length) {
      // RLS: agents only see their own profile; other authors show as "Office".
      const { data: ps } = await sb.from('profiles').select('id, full_name').in('id', ids)
      for (const p of (ps ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name)
    }
    return rows.map((r) => ({
      id: String(r.id),
      at: r.at,
      note: r.note ?? '',
      author: r.actor_id ? (names.get(r.actor_id) ?? 'Office') : undefined,
      nextActionDate: r.payload?.next_action_date ?? undefined,
    }))
  },

  async listAgents(includeInactive = false) {
    let q = getSupabase().from('profiles').select('id, full_name, active').eq('role', 'agent').order('full_name')
    if (!includeInactive) q = q.eq('active', true)
    const { data, error } = await q
    if (error) fail(error)
    return ((data ?? []) as { id: string; full_name: string; active: boolean | null }[]).map((p) => ({
      id: p.id,
      name: p.full_name,
      active: p.active ?? true,
    }))
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
export const listBanks = (includeInactive?: boolean) => active.listBanks(includeInactive)
export const listAgents = (includeInactive?: boolean) => active.listAgents(includeInactive)
export const listParties = () => active.listParties()
export const addBank = (i: NewBank) => active.addBank(i)
export const setBankActive = (id: string, a: boolean) => active.setBankActive(id, a)
export const addParty = (i: NewParty) => active.addParty(i)
export const listAllowedTransitions = () => active.listAllowedTransitions()
export const recordReceipt = (i: NewReceipt) => active.recordReceipt(i)
export const getBalance = (id: string) => active.getBalance(id)
export const replaceCheque = (id: string, version: number, newChequeNo: string, note?: string) =>
  active.replaceCheque(id, version, newChequeNo, note)
export const updateCheque = (id: string, version: number, patch: ChequePatch) =>
  active.updateCheque(id, version, patch)
export const updateBank = (id: string, patch: BankPatch) => active.updateBank(id, patch)
export const updateParty = (id: string, patch: PartyPatch) => active.updateParty(id, patch)
export const createAgent = (i: NewAgent) => active.createAgent(i)
export const setAgentActive = (id: string, a: boolean) => active.setAgentActive(id, a)
export const addRemark = (chequeId: string, remark: string, nextActionDate?: string) =>
  active.addRemark(chequeId, remark, nextActionDate)
export const listRemarks = (chequeId: string) => active.listRemarks(chequeId)
