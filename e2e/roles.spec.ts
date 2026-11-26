import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

// Local stack only. Seeded users: admin.dev / agent.dev @test.invalid. Password from E2E_PASSWORD.
const password = process.env.E2E_PASSWORD ?? ''
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const API = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' })

async function token(email: string): Promise<string> {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return ((await r.json()) as { access_token: string }).access_token
}

async function call(tok: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { apikey: KEY, authorization: `Bearer ${tok}`, 'content-type': 'application/json', ...init.headers },
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function login(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function fillNewCheque(page: Page, opts: { bank: string; party: string; no: string; admin: boolean }) {
  await page.getByRole('button', { name: 'New cheque', exact: true }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  if (!opts.admin) {
    await expect(dlg.getByLabel('Status')).toHaveCount(0)
    await expect(dlg.getByLabel('Agent')).toHaveCount(0)
  }
  await dlg.getByLabel('Bank', { exact: true }).click()
  await page.getByTitle(opts.bank).click()
  await dlg.locator('input#party').fill(opts.party)
  await dlg.getByPlaceholder('e.g. 100-009').fill(opts.no)
  await dlg.getByLabel('Amount (NPR)').fill('12345')
  await dlg.getByLabel('Maturity date').fill(today())
  await dlg.getByLabel('Maturity date').press('Enter')
  await dlg.getByRole('button', { name: 'Add cheque' }).click({ timeout: 2000 }).catch(() => {})
  await expect(dlg).toBeHidden()
}

test('admin creates a cheque from the dashboard New cheque button', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  const id = Date.now().toString().slice(-6)
  const party = `Test Party Roles ${id}`
  await login(page, 'admin.dev@test.invalid')
  await fillNewCheque(page, { bank: 'Test Bank Alpha', party, no: `ADM${id}`, admin: true })
  await expect(page.getByTestId('cheque-widget').filter({ hasText: party })).toBeVisible()
})

test('agent sees own cheques only, creates one, and records a cash receipt', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  const id = Date.now().toString().slice(-6)
  const party = `Test Party Agent ${id}`
  const no = `AGT${id}`
  await login(page, 'agent.dev@test.invalid')
  await expect(page.getByRole('menuitem')).toHaveCount(1)
  await expect(page.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible()

  await fillNewCheque(page, { bank: 'Test Bank Alpha', party, no, admin: false })
  const card = page.getByTestId('cheque-widget').filter({ hasText: party })
  await expect(card).toBeVisible()
  await expect(card).toContainText('With agent')
  await expect(card.getByRole('button', { name: 'Move status' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Hold' })).toHaveCount(0)

  // Only own cheques: every visible widget names this agent.
  await page.getByText('All', { exact: true }).click()
  const widgets = page.getByTestId('cheque-widget')
  const n = await widgets.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) await expect(widgets.nth(i)).toContainText('Agent: Test Agent')

  // Admin (API) bounces it; agent can then record cash.
  const admin = await token('admin.dev@test.invalid')
  const [row] = await call(admin, `/rest/v1/cheques?cheque_no_norm=eq.${no}&select=id,version`)
  let v: number = row.version
  for (const to of ['in_office', 'deposited', 'bounced']) {
    v = await call(admin, '/rest/v1/rpc/transition_cheque', {
      method: 'POST',
      body: JSON.stringify({ cheque_id: row.id, to_status: to, expected_version: v }),
    })
  }
  await page.reload()
  await page.getByText('All', { exact: true }).click()
  const bounced = page.getByTestId('cheque-widget').filter({ hasText: party })
  await expect(bounced).toContainText('Bounced')
  await expect(bounced.getByRole('button', { name: 'Move status' })).toHaveCount(0)
  await bounced.getByRole('button', { name: 'Record cash' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByTestId('receipt-balance')).toContainText('NPR 12,345')
  await dlg.getByLabel('Amount (NPR)').fill('2000')
  await dlg.getByRole('button', { name: 'Record', exact: true }).click()
  await expect(page.getByTestId('cheque-widget').filter({ hasText: party })).toContainText('Partial cash')
})
