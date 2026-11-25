import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const signInWithPassword = vi.fn()
vi.mock('../src/lib/supabase', () => ({ getSupabase: () => ({ auth: { signInWithPassword } }) }))

import LoginPage from '../src/features/LoginPage'

describe('LoginPage', () => {
  it('shows the error on a failed sign-in', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'x@test.invalid')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'x@test.invalid', password: 'wrong-password' })
  })
})
