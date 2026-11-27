import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AgentsPage from '../src/features/AgentsPage'
import BanksPage from '../src/features/BanksPage'
import ChequeForm from '../src/features/ChequeForm'
import ChequeWidget from '../src/features/ChequeWidget'
import Dashboard from '../src/features/Dashboard'
import PartiesPage from '../src/features/PartiesPage'
import { setRepo, type Cheque, type ChequeRepo } from '../src/data/chequeRepo'
import type { ChequeStatus } from '../src/data/transitions'
import { AuthContext } from '../src/lib/auth'
import { makeFakeRepo } from './fakeRepo'
import { openOption } from './bsPick'

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

const dialog = async () => within(await screen.findByRole('dialog'))
const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

describe('quick-add inside the cheque form', () => {
  let repo: ChequeRepo
  beforeEach(() => {
    repo = makeFakeRepo()
    setRepo(repo)
  })

  async function typeSome() {
    await screen.findByRole('combobox', { name: 'Bank' })
    await userEvent.type(screen.getByPlaceholderText('e.g. 100-009'), 'KEEP-001')
    await userEvent.type(screen.getByLabelText('Amount (NPR)'), '777')
    await userEvent.type(screen.getByLabelText('Note'), 'keep me')
  }
  function expectKept() {
    expect(screen.getByPlaceholderText('e.g. 100-009')).toHaveValue('KEEP-001')
    expect(screen.getByLabelText('Amount (NPR)')).toHaveValue('777.00')
    expect(screen.getByLabelText('Note')).toHaveValue('keep me')
  }

  it('adds a party from the popup, keeps typed fields and selects the new party', async () => {
    as('admin', <ChequeForm onAdded={() => {}} />)
    await typeSome()
    await userEvent.click(screen.getByRole('button', { name: '+ Add party' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Party name'), 'Test Party Quick')
    await userEvent.type(d.getByLabelText('Phone'), '9800000000')
    await userEvent.click(d.getByRole('button', { name: 'Add party' }))
    await closed()
    expect(document.querySelector('input#party')).toHaveValue('Test Party Quick')
    expectKept()
    expect((await repo.listParties()).some((p) => p.name === 'Test Party Quick' && p.phone === '9800000000')).toBe(true)
  })

  it('adds a bank from the popup, keeps typed fields and selects the new bank', async () => {
    as('admin', <ChequeForm onAdded={() => {}} />)
    await typeSome()
    await userEvent.click(screen.getByRole('button', { name: '+ Add bank' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Bank name'), 'Test Bank Quick')
    await userEvent.click(d.getByRole('button', { name: 'Add bank' }))
    await closed()
    await waitFor(() => expect(screen.getByTitle('Test Bank Quick')).toBeInTheDocument())
    expectKept()
  })

  it('admin adds an agent from the popup and it is selected', async () => {
    as('admin', <ChequeForm onAdded={() => {}} />)
    await typeSome()
    await userEvent.click(screen.getByRole('button', { name: '+ Add agent' }))
    const d = await dialog()
    expect(d.getByText(/shown once/i)).toBeInTheDocument()
    await userEvent.type(d.getByLabelText('Full name'), 'Test Agent Quick')
    await userEvent.type(d.getByLabelText('Email'), 'quick@test.invalid')
    await userEvent.type(d.getByLabelText('Password'), 'longenough-pw')
    await userEvent.click(d.getByRole('button', { name: 'Add agent' }))
    await closed()
    await waitFor(() => expect(screen.getByTitle('Test Agent Quick')).toBeInTheDocument())
    expectKept()
  })

  it('shows a duplicate error inline in the popup and keeps the popup open', async () => {
    as('admin', <ChequeForm onAdded={() => {}} />)
    await screen.findByRole('combobox', { name: 'Bank' })
    await userEvent.click(screen.getByRole('button', { name: '+ Add party' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Party name'), 'test  MART')
    await userEvent.click(d.getByRole('button', { name: 'Add party' }))
    expect(await d.findByRole('alert')).toHaveTextContent(/duplicate party/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cancel returns to the form unchanged', async () => {
    as('admin', <ChequeForm onAdded={() => {}} />)
    await typeSome()
    await userEvent.click(screen.getByRole('button', { name: '+ Add bank' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Bank name'), 'Test Bank Never')
    await userEvent.click(d.getByRole('button', { name: 'Cancel' }))
    await closed()
    expectKept()
    expect((await repo.listBanks(true)).some((b) => b.name === 'Test Bank Never')).toBe(false)
  })

  it('agent role gets the party popup but no bank or agent popup', async () => {
    as('agent', <ChequeForm onAdded={() => {}} />)
    await screen.findByRole('button', { name: 'Add cheque' })
    expect(screen.getByRole('button', { name: '+ Add party' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add bank' })).not.toBeInTheDocument()
  })
})

describe('Agents tab and page', () => {
  let repo: ChequeRepo
  beforeEach(() => {
    repo = makeFakeRepo()
    setRepo(repo)
  })

  it('admin sees the Agents tab, agent does not', async () => {
    h.role = 'admin'
    const first = render(<App />)
    expect(await screen.findByRole('menuitem', { name: 'Agents' })).toBeInTheDocument()
    first.unmount()
    h.role = 'agent'
    render(<App />)
    await screen.findByTestId('user-menu')
    expect(screen.queryByRole('menuitem', { name: 'Agents' })).not.toBeInTheDocument()
  })

  it('lists, adds and toggles agents', async () => {
    await repo.createAgent({ email: 'a@test.invalid', password: 'longenough-pw', fullName: 'Test Agent One' })
    as('admin', <AgentsPage />)
    expect(await screen.findByText('Test Agent One')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Full name'), 'Test Agent Two')
    await userEvent.type(d.getByLabelText('Email'), 'b@test.invalid')
    await userEvent.type(d.getByLabelText('Password'), 'longenough-pw')
    await userEvent.click(d.getByRole('button', { name: 'Add agent' }))
    expect(await screen.findByText('Test Agent Two')).toBeInTheDocument()
    const sw = screen.getByRole('switch', { name: 'Active Test Agent One' })
    expect(sw).toBeChecked()
    await userEvent.click(sw)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Active Test Agent One' })).not.toBeChecked())
  })

  it('shows Edge Function errors readably inside the popup', async () => {
    vi.spyOn(repo, 'createAgent').mockRejectedValue(new Error('A user with this email address has already been registered'))
    as('admin', <AgentsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add agent' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Full name'), 'Test Agent Dup')
    await userEvent.type(d.getByLabelText('Email'), 'dup@test.invalid')
    await userEvent.type(d.getByLabelText('Password'), 'longenough-pw')
    await userEvent.click(d.getByRole('button', { name: 'Add agent' }))
    expect(await d.findByRole('alert')).toHaveTextContent('already been registered')
  })

  it('cannot toggle yourself', async () => {
    vi.spyOn(repo, 'listAgents').mockResolvedValue([
      { id: 'u1', name: 'Test Self', active: true },
      { id: 'x2', name: 'Test Other', active: true },
    ])
    as('admin', <AgentsPage />)
    expect(await screen.findByRole('switch', { name: 'Active Test Self' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Active Test Other' })).toBeEnabled()
  })
})

describe('editing cheques', () => {
  let repo: ChequeRepo
  beforeEach(() => {
    repo = makeFakeRepo()
    setRepo(repo)
  })

  async function openEdit() {
    await screen.findAllByTestId('cheque-widget')
    await userEvent.type(screen.getByPlaceholderText('Party or cheque no'), 'Test Traders')
    const card = screen.getAllByTestId('cheque-widget')[0]
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }))
    const d = await dialog()
    // Wait for the bank id to be resolved from the loaded list.
    await waitFor(() => expect(screen.getByTitle('Test Bank Himalaya')).toBeInTheDocument())
    return d
  }

  it('sends only the changed field with the current version and refreshes the widget', async () => {
    const spy = vi.spyOn(repo, 'updateCheque')
    as('admin', <Dashboard />)
    const d = await openEdit()
    expect(d.queryByLabelText('Status')).not.toBeInTheDocument()
    const no = d.getByPlaceholderText('e.g. 100-009')
    await userEvent.clear(no)
    await userEvent.type(no, 'NEW-5555')
    await userEvent.click(d.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy.mock.calls[0]).toEqual(['fake-1', 1, { chequeNo: 'NEW5555' }])
    expect(await screen.findByText('⑈NEW5555⑈')).toBeInTheDocument()
  })

  it('shows "This cheque changed, reload" on a version conflict', async () => {
    vi.spyOn(repo, 'updateCheque').mockRejectedValue(new Error('This cheque was changed by someone else, reload'))
    as('admin', <Dashboard />)
    const d = await openEdit()
    const no = d.getByPlaceholderText('e.g. 100-009')
    await userEvent.clear(no)
    await userEvent.type(no, 'NEW-5555')
    await userEvent.click(d.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('This cheque changed, reload')).toBeInTheDocument()
  })

  it('shows server errors readably', async () => {
    vi.spyOn(repo, 'updateCheque').mockRejectedValue(new Error('amount cannot be below the amount already received'))
    as('admin', <Dashboard />)
    const d = await openEdit()
    const no = d.getByPlaceholderText('e.g. 100-009')
    await userEvent.clear(no)
    await userEvent.type(no, 'NEW-5555')
    await userEvent.click(d.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('amount cannot be below the amount already received')).toBeInTheDocument()
  })

  const base: Cheque = {
    id: 'w1',
    bank: 'Test Bank Himalaya',
    party: 'Test Mart',
    chequeNoNorm: 'ABCD1234',
    amountPaisa: 100000n,
    receivedDate: '2026-01-01',
    maturityDate: '2026-02-01',
    status: 'in_office',
    version: 3,
  }
  const widget = (status: ChequeStatus) => (
    <ChequeWidget cheque={{ ...base, status }} overdue={false} allowedTo={[]} onChanged={() => {}} />
  )

  it('Edit is hidden on terminal statuses and for agents', () => {
    for (const s of ['cleared', 'closed_full_cash', 'replaced', 'party_flagged'] as ChequeStatus[]) {
      const r = as('admin', widget(s))
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
      r.unmount()
    }
    const r = as('agent', widget('in_office'))
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    r.unmount()
    as('admin', widget('in_office'))
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })
})

describe('editing banks and parties', () => {
  beforeEach(() => setRepo(makeFakeRepo()))

  it('edits a bank name', async () => {
    render(<BanksPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Test Bank Everest' }))
    const d = await dialog()
    const name = d.getByLabelText('Bank name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Test Bank Renamed')
    await userEvent.click(d.getByRole('button', { name: 'Save bank' }))
    expect(await screen.findByText('Test Bank Renamed')).toBeInTheDocument()
  })

  it('shows a duplicate error when renaming a bank to an existing one', async () => {
    render(<BanksPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Test Bank Everest' }))
    const d = await dialog()
    const name = d.getByLabelText('Bank name')
    await userEvent.clear(name)
    await userEvent.type(name, 'test bank himalaya')
    await userEvent.click(d.getByRole('button', { name: 'Save bank' }))
    expect(await d.findByRole('alert')).toHaveTextContent(/duplicate bank/i)
  })

  it('shows a duplicate error when renaming a party to an existing one', async () => {
    render(<PartiesPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Test Mart' }))
    const d = await dialog()
    const name = d.getByLabelText('Party name')
    await userEvent.clear(name)
    await userEvent.type(name, 'TEST traders pvt')
    await userEvent.click(d.getByRole('button', { name: 'Save party' }))
    expect(await d.findByRole('alert')).toHaveTextContent(/duplicate party/i)
  })

  it('edits a party phone', async () => {
    render(<PartiesPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Test Mart' }))
    const d = await dialog()
    await userEvent.type(d.getByLabelText('Phone'), '9811111111')
    await userEvent.click(d.getByRole('button', { name: 'Save party' }))
    expect(await screen.findByText('9811111111')).toBeInTheDocument()
  })
})

void openOption
