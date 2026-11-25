import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Dashboard from '../src/features/Dashboard'
import { setRepo } from '../src/data/chequeRepo'
import { todayKathmandu } from '../src/lib/bsdate'
import { makeFakeRepo } from './fakeRepo'

describe('Dashboard', () => {
  beforeEach(() => setRepo(makeFakeRepo()))

  it("renders today's date", () => {
    render(<Dashboard />)
    expect(screen.getByTestId('today')).toHaveTextContent(todayKathmandu())
  })

  it('filter narrows the list', async () => {
    render(<Dashboard />)
    await screen.findAllByTestId('cheque-widget')
    const before = screen.getAllByTestId('cheque-widget').length
    await userEvent.type(screen.getByPlaceholderText('Party or cheque no'), 'Test Agro')
    const after = screen.getAllByTestId('cheque-widget').length
    expect(after).toBeLessThan(before)
    expect(after).toBe(1)
  })

  it('Hold moves a cheque and its status tag changes', async () => {
    render(<Dashboard />)
    await screen.findAllByTestId('cheque-widget')
    await userEvent.type(screen.getByPlaceholderText('Party or cheque no'), 'Test Traders')
    const card = screen.getAllByTestId('cheque-widget')[0]
    expect(within(card).getByText('In office')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Hold' }))
    await waitFor(() =>
      expect(within(screen.getAllByTestId('cheque-widget')[0]).getByText('On hold (PDC)')).toBeInTheDocument(),
    )
  })
})
