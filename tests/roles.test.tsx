import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../src/features/Dashboard'
import ChequeForm from '../src/features/ChequeForm'
import { setRepo, type ChequeRepo } from '../src/data/chequeRepo'
import { AuthContext } from '../src/lib/auth'
import { addDays } from '../src/data/chequeRepo'
import { todayKathmandu } from '../src/lib/bsdate'
import { makeFakeRepo } from './fakeRepo'

const h = vi.hoisted(() => ({ role: 'agent' as 'admin' | 'agent' }))

vi.mock('../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'x@test.invalid' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: h.role } }) }) }),
    }),
  }),
}))

import App from '../src/App'

function as(role: 'admin' | 'agent', ui: ReactElement) {
  return render(
    <AuthContext.Provider
      value={{
        session: { user: { id: 'u1', email: `${role}@test.invalid` } } as never,
        role,
        loading: false,
        signOut: async () => {},
      }}
    >
      {ui}
    </AuthContext.Provider>,
  )
}

async function cardFor(text: string) {
  await screen.findAllByTestId('cheque-widget')
  await userEvent.clear(screen.getByPlaceholderText('Party or cheque no'))
  await userEvent.type(screen.getByPlaceholderText('Party or cheque no'), text)
  await waitFor(() => expect(screen.getAllByTestId('cheque-widget')).toHaveLength(1))
  return screen.getByTestId('cheque-widget')
}

describe('role-aware dashboard actions', () => {
  let repo: ChequeRepo
  beforeEach(() => {
    repo = makeFakeRepo()
    setRepo(repo)
  })

  it('agent gets no admin moves on a with_agent cheque', async () => {
    as('agent', <Dashboard />)
    const card = await cardFor('Test Mart')
    expect(within(card).getByText('With agent')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Hold' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Move status' })).not.toBeInTheDocument()
  })

  it('agent sees Record cash (not Move status) on a bounced cheque', async () => {
    as('agent', <Dashboard />)
    const card = await cardFor('Test Hardware')
    expect(within(card).getByRole('button', { name: 'Record cash' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Move status' })).not.toBeInTheDocument()
  })

  it('admin keeps Hold and Move status but not agent-only restrictions', async () => {
    as('admin', <Dashboard />)
    const card = await cardFor('Test Traders')
    expect(within(card).getByRole('button', { name: 'Hold' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Move status' })).toBeInTheDocument()
  })

  it('Record cash opens, shows the balance and calls recordReceipt on the repo', async () => {
    const spy = vi.spyOn(repo, 'recordReceipt')
    as('agent', <Dashboard />)
    const card = await cardFor('Test Hardware')
    await userEvent.click(within(card).getByRole('button', { name: 'Record cash' }))
    const dialog = (await screen.findByTestId('receipt-balance')).closest('[role="dialog"]') as HTMLElement
    await waitFor(() => expect(within(dialog).getByTestId('receipt-balance')).toHaveTextContent('NPR 22,000'))
    await userEvent.type(within(dialog).getByLabelText('Amount (NPR)'), '5000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy.mock.calls[0][0]).toMatchObject({
      chequeId: 'fake-5',
      amountPaisa: 500000n,
      method: 'cash',
      receivedOn: todayKathmandu(),
    })
    await waitFor(() => expect(within(screen.getByTestId('cheque-widget')).getByText('Partial cash')).toBeInTheDocument())
  })

  it('admin sees a New cheque button on the dashboard that opens the form', async () => {
    as('admin', <Dashboard />)
    await userEvent.click(await screen.findByRole('button', { name: 'New cheque' }))
    expect(await screen.findByRole('button', { name: 'Add cheque' })).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
  })

  it('agent New cheque form hides status and agent fields', async () => {
    as('agent', <ChequeForm onAdded={() => {}} />)
    await screen.findByRole('button', { name: 'Add cheque' })
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Agent')).not.toBeInTheDocument()
  })

  it('agent sees only the Dashboard tab', async () => {
    h.role = 'agent'
    render(<App />)
    await screen.findByTestId('user-menu')
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeInTheDocument()
    for (const n of ['Banks', 'Parties', 'New cheque']) {
      expect(screen.queryByRole('menuitem', { name: n })).not.toBeInTheDocument()
    }
  })
})

describe('stale-date warning', () => {
  it('warns (non-blocking) when maturity is more than 6 months before the received date', async () => {
    setRepo(makeFakeRepo())
    render(<ChequeForm onAdded={() => {}} />)
    const m = await screen.findByLabelText('Maturity date')
    await userEvent.type(m, `${dayjs(addDays(todayKathmandu(), -300)).format('YYYY-MM-DD')}{Enter}`)
    expect(await screen.findByText(/more than 6 months before the received date/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add cheque' })).toBeEnabled()
  })

  it('does not warn for a recent maturity date', async () => {
    setRepo(makeFakeRepo())
    render(<ChequeForm onAdded={() => {}} />)
    const m = await screen.findByLabelText('Maturity date')
    await userEvent.type(m, `${addDays(todayKathmandu(), 10)}{Enter}`)
    await waitFor(() => expect(m).toHaveValue(addDays(todayKathmandu(), 10)))
    expect(screen.queryByText(/more than 6 months before/)).not.toBeInTheDocument()
  })
})
