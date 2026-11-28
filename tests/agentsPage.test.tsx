import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import AgentsPage, { isWithAgent } from '../src/features/AgentsPage'
import type { Cheque } from '../src/data/chequeRepo'
import { setRepo } from '../src/data/chequeRepo'
import { AuthContext } from '../src/lib/auth'
import { makeFakeRepo } from './fakeRepo'

const asAdmin = (ui: React.ReactElement) =>
  render(
    <AuthContext.Provider value={{ session: null, role: 'admin', loading: false, signOut: async () => {} }}>
      {ui}
    </AuthContext.Provider>,
  )

describe('AgentsPage: cheques per agent', () => {
  beforeEach(async () => {
    const repo = makeFakeRepo()
    // ids agent-1 / agent-2 match the seeded with_agent cheques (Test Mart, Test Agro)
    await repo.createAgent({ email: 'a@test.invalid', password: 'longenough-pw', fullName: 'Test Agent A' })
    await repo.createAgent({ email: 'b@test.invalid', password: 'longenough-pw', fullName: 'Test Agent B' })
    await repo.createAgent({ email: 'c@test.invalid', password: 'longenough-pw', fullName: 'Test Agent C' })
    setRepo(repo)
  })

  it('shows the total and lists each agent’s cheques', async () => {
    asAdmin(<AgentsPage />)
    const a = await screen.findByTestId('held-agent-1')
    expect(within(a).getByText('Test Mart')).toBeInTheDocument()
    expect(within(screen.getByTestId('held-agent-2')).getByText('Test Agro')).toBeInTheDocument()
    expect(screen.queryByTestId('held-agent-3')).toBeNull()
    expect(within(screen.getByTestId('with-agents-summary')).getByText('2')).toBeInTheDocument()
  })
})

describe('isWithAgent', () => {
  const row = (status: string, agentId: string | null) => ({ status, agentId }) as unknown as Cheque
  it('counts only cheques an agent physically holds', () => {
    expect(isWithAgent(row('with_agent', 'agent-1'))).toBe(true)
    expect(isWithAgent(row('bounced', 'agent-1'))).toBe(true)
    expect(isWithAgent(row('partial_cash', 'agent-1'))).toBe(true)
    // stale agent_id after the cheque came back or went to the bank
    expect(isWithAgent(row('in_office', 'agent-1'))).toBe(false)
    expect(isWithAgent(row('deposited', 'agent-1'))).toBe(false)
    expect(isWithAgent(row('pdc_hold', 'agent-1'))).toBe(false)
    expect(isWithAgent(row('bounced', null))).toBe(false)
  })
})
