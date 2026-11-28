import { addDays, normaliseName, type AllowedTransition, type Bank, type Agent, type Cheque, type ChequeRepo, type Party, type Remark } from '../src/data/chequeRepo'
import { ALLOWED_ROWS, transitionsFor } from '../src/data/transitions'
import { todayKathmandu } from '../src/lib/bsdate'
import type { ChequeStatus } from '../src/data/transitions'

/** In-memory ChequeRepo for tests. Synthetic data only. role decides which transitions are legal. */
export function makeFakeRepo(role: 'admin' | 'agent' = 'admin'): ChequeRepo {
  const moves = transitionsFor(role)
  const today = todayKathmandu()
  const mk = (
    n: number,
    bank: string,
    party: string,
    rupees: number,
    matOffset: number,
    status: ChequeStatus,
    agent?: string,
  ): Cheque => ({
    id: `fake-${n}`,
    bank,
    party,
    chequeNoNorm: `10000${n}`,
    amountPaisa: BigInt(rupees) * 100n,
    receivedDate: addDays(today, -30),
    maturityDate: addDays(today, matOffset),
    status,
    agent,
    agentId: agent ? `agent-${agent.endsWith('A') ? 1 : 2}` : undefined,
    version: 1,
  })
  const rows: Cheque[] = [
    mk(1, 'Test Bank Himalaya', 'Test Traders Pvt', 125000, 0, 'in_office'),
    mk(2, 'Test Bank Annapurna', 'Test Mart', 48500, -3, 'with_agent', 'Test Agent A'),
    mk(3, 'Test Bank Everest', 'Test Stores', 310000, 15, 'in_office'),
    mk(4, 'Test Bank Himalaya', 'Test Enterprises', 87250, -1, 'deposited'),
    mk(5, 'Test Bank Kavre', 'Test Hardware', 22000, -12, 'bounced'),
    mk(6, 'Test Bank Annapurna', 'Test Agro', 99999, 0, 'with_agent', 'Test Agent B'),
  ]
  const banks: Bank[] = [
    { id: 'b1', name: 'Test Bank Himalaya', kind: 'bank', active: true },
    { id: 'b2', name: 'Test Bank Everest', kind: 'bank', active: true },
  ]
  const parties: Party[] = [
    { id: 'p1', name: 'Test Traders Pvt' },
    { id: 'p2', name: 'Test Mart' },
  ]
  const agents: Agent[] = []
  const receipts: { chequeId: string; amountPaisa: bigint }[] = []
  const allowed: AllowedTransition[] = ALLOWED_ROWS.map((r) => ({ ...r }))
  const remarks: (Remark & { chequeId: string })[] = []
  return {
    async listAllowedTransitions() {
      return allowed.map((a) => ({ ...a }))
    },
    async getBalance(id) {
      const c = rows.find((r) => r.id === id)
      if (!c) throw new Error('cheque not found')
      return c.amountPaisa - receipts.filter((r) => r.chequeId === id).reduce((a, r) => a + r.amountPaisa, 0n)
    },
    async recordReceipt(i) {
      const c = rows.find((r) => r.id === i.chequeId)
      if (!c) throw new Error('cheque not found')
      if (c.status !== 'bounced' && c.status !== 'partial_cash') throw new Error('receipts are only accepted on bounced or partial_cash cheques')
      const bal = await this.getBalance(i.chequeId)
      if (i.amountPaisa <= 0n || i.amountPaisa > bal) throw new Error('receipt amount exceeds the outstanding balance')
      receipts.push({ chequeId: i.chequeId, amountPaisa: i.amountPaisa })
      c.status = i.amountPaisa === bal ? 'closed_full_cash' : 'partial_cash'
      c.version += 1
    },
    async listCheques() {
      return rows.map((r) => ({ ...r }))
    },
    async addCheque(i) {
      const bank = banks.find((b) => b.id === i.bankId)?.name ?? ''
      const no = i.chequeNo.replace(/[\s-]/g, '').toUpperCase()
      if (rows.some((r) => r.bank === bank && r.chequeNoNorm === no && r.party === i.party && r.status !== 'replaced')) {
        throw new Error('duplicate cheque: same bank, cheque number and party already exists')
      }
      rows.push({
        id: `fake-${rows.length + 1}`, bank, party: i.party, chequeNoNorm: no, amountPaisa: i.amountPaisa,
        receivedDate: i.receivedDate, maturityDate: i.maturityDate, status: i.status, version: 1,
      })
    },
    async transitionCheque(id, to, version) {
      const c = rows.find((r) => r.id === id)
      if (!c) throw new Error('cheque not found')
      if (c.version !== version) throw new Error('This cheque was changed by someone else, reload')
      if (!moves[c.status].includes(to)) throw new Error(`Illegal transition ${c.status} -> ${to}`)
      c.status = to
      c.version += 1
    },
    async replaceCheque(id, version, newChequeNo) {
      const c = rows.find((r) => r.id === id)
      if (!c) throw new Error('cheque not found')
      if (c.version !== version) throw new Error('This cheque was changed by someone else, reload')
      if (!['bounced', 'partial_cash', 'stale'].includes(c.status)) throw new Error(`Illegal transition ${c.status} -> replaced`)
      const bal = await this.getBalance(id)
      c.status = 'replaced'
      c.version += 1
      rows.push({
        ...c, id: `fake-${rows.length + 1}`, chequeNoNorm: newChequeNo.replace(/[\s-]/g, '').toUpperCase(),
        amountPaisa: bal, status: 'in_office', version: 1,
      })
    },
    async listBanks(includeInactive = false) {
      return banks.filter((b) => includeInactive || b.active).map((b) => ({ ...b }))
    },
    async listParties() {
      return parties.map((p) => ({ ...p }))
    },
    async addBank(i) {
      if (banks.some((b) => normaliseName(b.name) === normaliseName(i.name))) {
        throw new Error(`Duplicate bank: "${i.name.trim()}" already exists`)
      }
      banks.push({ id: `b${banks.length + 1}`, name: i.name.trim(), kind: i.kind, active: true })
    },
    async setBankActive(id, active) {
      const b = banks.find((x) => x.id === id)
      if (!b) throw new Error('bank not found')
      b.active = active
    },
    async addParty(i) {
      if (parties.some((p) => normaliseName(p.name) === normaliseName(i.name))) {
        throw new Error(`Duplicate party: "${i.name.trim()}" already exists`)
      }
      const id = `p${parties.length + 1}`
      parties.push({ id, name: i.name.trim(), phone: i.phone ?? null, address: i.address ?? null })
      return id
    },
    async listAgents(includeInactive = false) {
      return agents.filter((a) => includeInactive || a.active).map((a) => ({ ...a }))
    },
    async updateCheque(id, version, patch) {
      const c = rows.find((r) => r.id === id)
      if (!c) throw new Error('cheque not found')
      if (c.version !== version) throw new Error('This cheque was changed by someone else, reload')
      if (['cleared', 'closed_full_cash', 'replaced', 'party_flagged'].includes(c.status)) {
        throw new Error(`cheque in status ${c.status} can no longer be edited`)
      }
      if (patch.amountPaisa !== undefined) {
        const paid = receipts.filter((r) => r.chequeId === id).reduce((a, r) => a + r.amountPaisa, 0n)
        if (patch.amountPaisa < paid) throw new Error('amount cannot be below the amount already received')
        c.amountPaisa = patch.amountPaisa
      }
      if (patch.chequeNo !== undefined) c.chequeNoNorm = patch.chequeNo.replace(/[\s-]/g, '').toUpperCase()
      if (patch.receivedDate !== undefined) c.receivedDate = patch.receivedDate
      if (patch.maturityDate !== undefined) c.maturityDate = patch.maturityDate
      if (patch.note !== undefined) c.note = patch.note ?? undefined
      if (patch.bankId !== undefined) c.bank = banks.find((b) => b.id === patch.bankId)?.name ?? c.bank
      if (patch.partyId !== undefined) c.party = parties.find((p) => p.id === patch.partyId)?.name ?? c.party
      if (patch.agentId !== undefined) c.agent = agents.find((a) => a.id === patch.agentId)?.name
      c.version += 1
      return c.version
    },
    async updateBank(id, patch) {
      const b = banks.find((x) => x.id === id)
      if (!b) throw new Error('bank not found')
      if (patch.name !== undefined) {
        if (banks.some((x) => x.id !== id && normaliseName(x.name) === normaliseName(patch.name!))) {
          throw new Error(`duplicate bank: "${patch.name.trim()}" already exists`)
        }
        b.name = patch.name.trim()
      }
      if (patch.kind !== undefined) b.kind = patch.kind
      if (patch.active !== undefined) b.active = patch.active
    },
    async updateParty(id, patch) {
      const p = parties.find((x) => x.id === id)
      if (!p) throw new Error('party not found')
      if (patch.name !== undefined) {
        if (parties.some((x) => x.id !== id && normaliseName(x.name) === normaliseName(patch.name!))) {
          throw new Error(`duplicate party: "${patch.name.trim()}" already exists`)
        }
        p.name = patch.name.trim()
      }
      if (patch.phone !== undefined) p.phone = patch.phone
      if (patch.address !== undefined) p.address = patch.address
    },
    async createAgent(i) {
      if (i.password.length < 10) throw new Error('password must be at least 10 characters')
      const id = `agent-${agents.length + 1}`
      agents.push({ id, name: i.fullName, active: true })
      return { id, email: i.email, role: i.role ?? 'agent' }
    },
    async addRemark(chequeId, remark, nextActionDate) {
      const c = rows.find((r) => r.id === chequeId)
      if (!c) throw new Error('cheque not found')
      const text = remark.trim()
      if (!text) throw new Error('remark cannot be empty')
      if (nextActionDate) {
        if (nextActionDate < today) throw new Error('follow-up date cannot be in the past')
        c.nextActionDate = nextActionDate
        c.version += 1
      }
      remarks.unshift({ id: `r${remarks.length + 1}`, chequeId, at: new Date().toISOString(), note: text, author: 'Test User', nextActionDate })
    },
    async listRemarks(chequeId) {
      return remarks.filter((r) => r.chequeId === chequeId).map(({ chequeId: _c, ...r }) => ({ ...r }))
    },
    async setAgentActive(id, active) {
      const a = agents.find((x) => x.id === id)
      if (!a) throw new Error('profile not found')
      a.active = active
    },
  }
}
