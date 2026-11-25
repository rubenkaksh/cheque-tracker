import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BanksPage from '../src/features/BanksPage'
import PartiesPage from '../src/features/PartiesPage'
import { setRepo } from '../src/data/chequeRepo'
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

describe('Banks page', () => {
  beforeEach(() => setRepo(makeFakeRepo()))

  it('adding a bank shows it in the list', async () => {
    render(<BanksPage />)
    await screen.findByText('Test Bank Himalaya')
    await userEvent.type(screen.getByLabelText('Bank name'), 'Test Bank Omega')
    await userEvent.click(screen.getByRole('button', { name: 'Add bank' }))
    expect(await screen.findByText('Test Bank Omega')).toBeInTheDocument()
  })

  it('shows a duplicate error as an alert', async () => {
    render(<BanksPage />)
    await screen.findByText('Test Bank Himalaya')
    await userEvent.type(screen.getByLabelText('Bank name'), 'test bank  himalaya')
    await userEvent.click(screen.getByRole('button', { name: 'Add bank' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/duplicate bank/i)
  })

  it('toggles a bank inactive', async () => {
    render(<BanksPage />)
    const sw = await screen.findByRole('switch', { name: 'Active Test Bank Everest' })
    expect(sw).toBeChecked()
    await userEvent.click(sw)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Active Test Bank Everest' })).not.toBeChecked())
  })
})

describe('Parties page', () => {
  beforeEach(() => setRepo(makeFakeRepo()))

  it('adding a party shows it in the list', async () => {
    render(<PartiesPage />)
    await screen.findByText('Test Mart')
    await userEvent.type(screen.getByLabelText('Party name'), 'Test Party Omega')
    await userEvent.click(screen.getByRole('button', { name: 'Add party' }))
    expect(await screen.findByText('Test Party Omega')).toBeInTheDocument()
  })

  it('shows a normalised-name duplicate as an alert', async () => {
    render(<PartiesPage />)
    await screen.findByText('Test Mart')
    await userEvent.type(screen.getByLabelText('Party name'), '  TEST   mart ')
    await userEvent.click(screen.getByRole('button', { name: 'Add party' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/duplicate party/i)
  })
})

describe('Admin-only tabs', () => {
  beforeEach(() => setRepo(makeFakeRepo()))

  it('agent does not see Banks, Parties or New cheque', async () => {
    h.role = 'agent'
    render(<App />)
    await screen.findByTestId('user-menu')
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeInTheDocument()
    for (const n of ['Banks', 'Parties', 'New cheque']) {
      expect(screen.queryByRole('menuitem', { name: n })).not.toBeInTheDocument()
    }
  })

  it('admin sees Banks and Parties and can open them', async () => {
    h.role = 'admin'
    render(<App />)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Banks' }))
    expect(await screen.findByRole('heading', { name: 'Banks' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Parties' }))
    const h2 = await screen.findByRole('heading', { name: 'Parties' })
    expect(within(h2.parentElement as HTMLElement).getByRole('button', { name: 'Add party' })).toBeInTheDocument()
  })
})
