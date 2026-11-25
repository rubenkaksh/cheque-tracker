import { addDays, type Cheque, type ChequeRepo } from '../src/data/chequeRepo'
import { TRANSITIONS } from '../src/data/transitions'
import { todayKathmandu } from '../src/lib/bsdate'
import type { ChequeStatus } from '../src/data/transitions'

/** In-memory ChequeRepo for tests. Synthetic data only. */
export function makeFakeRepo(): ChequeRepo {
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
  const banks = [
    { id: 'b1', name: 'Test Bank Himalaya' },
    { id: 'b2', name: 'Test Bank Everest' },
  ]
  return {
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
      if (!TRANSITIONS[c.status].includes(to)) throw new Error(`Illegal transition ${c.status} -> ${to}`)
      c.status = to
      c.version += 1
    },
    async listBanks() {
      return banks
    },
    async listAgents() {
      return []
    },
  }
}
