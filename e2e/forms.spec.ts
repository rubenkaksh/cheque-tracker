import { test, expect } from '@playwright/test'

// Local stack only. Admin password from env.
const password = process.env.E2E_PASSWORD ?? ''

test('admin adds a bank and party, then a cheque appears on the dashboard', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  const id = Date.now().toString().slice(-6)
  const bank = `Test Bank E2E ${id}`
  const party = `Test Party E2E ${id}`

  await page.goto('/')
  await page.getByLabel('Email').fill('admin.dev@test.invalid')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('menuitem', { name: 'Banks' }).click()
  await page.getByLabel('Bank name').fill(bank)
  await page.getByRole('button', { name: 'Add bank' }).click()
  await expect(page.getByRole('cell', { name: bank, exact: true })).toBeVisible()

  await page.getByRole('menuitem', { name: 'Parties' }).click()
  await page.getByLabel('Party name').fill(party)
  await page.getByRole('button', { name: 'Add party' }).click()
  await expect(page.getByRole('cell', { name: party, exact: true })).toBeVisible()

  await page.getByRole('menuitem', { name: 'New cheque' }).click()
  await page.getByLabel('Bank', { exact: true }).click()
  await page.getByTitle(bank).click()
  await page.locator('input#party').fill(party)
  await page.getByPlaceholder('e.g. 100-009').fill(`E2E${id}`)
  await page.getByLabel('Amount (NPR)').fill('12345')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' })
  await page.getByLabel('Maturity date').fill(today)
  await page.getByLabel('Maturity date').press('Enter') // commits the date; antd also submits the form
  await page.getByRole('button', { name: 'Add cheque' }).click({ timeout: 2000 }).catch(() => {})

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('cheque-widget').filter({ hasText: party })).toBeVisible()
})
