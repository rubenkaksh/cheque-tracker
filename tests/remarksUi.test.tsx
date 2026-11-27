import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import Dashboard from '../src/features/Dashboard'
import { setRepo, type ChequeRepo } from '../src/data/chequeRepo'
import { ALLOWED_ROWS, isMatured } from '../src/data/transitions'
import { AuthContext } from '../src/lib/auth'
import { todayKathmandu } from '../src/lib/bsdate'
import { makeFakeRepo } from './fakeRepo'

function as(role: 'admin' | 'agent', ui: ReactElement) {
  return render(
    <AuthContext.Provider value={{ session: null, role, loading: false, signOut: async () => {} }}>
      {ui}
    </AuthContext.Provider>,
  )
}

async function cardFor(party: string) {
  await screen.findAllByTestId('cheque-widget')
  await userEvent.click(screen.getByText('All'))
  const cards = screen.getAllByTestId('cheque-widget')
  const card = cards.find((c) => within(c).queryByText(party))
  if (!card) throw new Error(`no card for ${party}`)
  return card
}

describe('flow-diagram UI (migration 0010)', () => {
  let repo: ChequeRepo
  beforeEach(() => {
    repo = makeFakeRepo()
    setRepo(repo)
  })

  it('ALLOWED_ROWS mirrors the 37 DB rows, 6 of them for agents', () => {
    expect(ALLOWED_ROWS).toHaveLength(37)
    expect(ALLOWED_ROWS.filter((r) => r.role === 'agent')).toHaveLength(6)
  })

  it('isMatured: only pre-deposit statuses on or after the maturity date', () => {
    const t = '2026-11-27'
    expect(isMatured('pdc_hold', t, t)).toBe(true)
    expect(isMatured('with_agent', '2026-11-20', t)).toBe(true)
    expect(isMatured('in_office', '2026-12-01', t)).toBe(false)
    expect(isMatured('deposited', '2026-11-20', t)).toBe(false)
  })

  it('shows the Matured tag on a matured cheque and not on a future one', async () => {
    as('admin', <Dashboard />)
    expect(within(await cardFor('Test Traders Pvt')).getByTestId('matured-tag')).toBeInTheDocument()
    expect(within(await cardFor('Test Stores')).queryByTestId('matured-tag')).not.toBeInTheDocument()
  })

  it('admin adds a remark with a follow-up date; it is listed and shown on the card', async () => {
    as('admin', <Dashboard />)
    const card = await cardFor('Test Hardware')
    await userEvent.click(within(card).getByRole('button', { name: 'Remarks' }))
    const panel = await screen.findByTestId('remarks-panel')
    await userEvent.type(within(panel).getByLabelText('Remark'), 'Party promised cash on Friday')
    await userEvent.click(within(panel).getByLabelText('Set next follow-up date'))
    await userEvent.click(within(panel).getByRole('button', { name: 'Add remark' }))
    await waitFor(() =>
      expect(within(screen.getByTestId('remarks-list')).getByText('Party promised cash on Friday')).toBeInTheDocument(),
    )
    await waitFor(async () => expect(within(await cardFor('Test Hardware')).getByTestId('follow-up')).toBeInTheDocument())
  })

  it('bounced cheque with no agent reads as on hold; admin can hand it to an agent, agent cannot', async () => {
    const r = as('admin', <Dashboard />)
    const card = await cardFor('Test Hardware')
    expect(within(card).getByTestId('custody')).toHaveTextContent('On hold at office (no agent)')
    expect(within(card).getByRole('button', { name: 'Hand to agent' })).toBeInTheDocument()
    r.unmount()
    as('agent', <Dashboard />)
    const agentCard = await cardFor('Test Hardware')
    expect(within(agentCard).queryByRole('button', { name: 'Hand to agent' })).not.toBeInTheDocument()
    expect(within(agentCard).getByRole('button', { name: 'Remarks' })).toBeInTheDocument()
  })

  it('Follow-ups due range lists only cheques whose follow-up date has come', async () => {
    await repo.addRemark('fake-5', 'Visit today', todayKathmandu())
    as('admin', <Dashboard />)
    await screen.findAllByTestId('cheque-widget')
    await userEvent.click(screen.getByText('Follow-ups due (1)'))
    const cards = screen.getAllByTestId('cheque-widget')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByTestId('follow-up')).toHaveTextContent('(due)')
  })
})
