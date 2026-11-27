import { test, expect } from '@playwright/test'

// Runs against the LOCAL Supabase stack with seeded users. Password comes from env (see .env.example).
const email = process.env.E2E_ADMIN_EMAIL ?? 'admin.dev@test.invalid'
const password = process.env.E2E_PASSWORD ?? ''

test('admin logs in, sees dashboard and email, logs out', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  await page.goto('./')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('user-menu')).toContainText(email)
  await expect(page.getByTestId('user-menu')).toContainText('admin')
  await page.getByTestId('user-menu').click()
  await page.getByText('Logout').click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('agent sees dashboard only', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  await page.goto('./')
  await page.getByLabel('Email').fill('agent.dev@test.invalid')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('user-menu')).toContainText('agent')
  await expect(page.getByRole('menuitem', { name: 'New cheque' })).toHaveCount(0)
  console.log('AGENT_TEXT:', (await page.locator('#root').innerText()).replace(/\n+/g, ' | '))
})
