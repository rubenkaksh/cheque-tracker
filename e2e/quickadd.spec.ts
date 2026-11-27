import { test, expect, type Page } from '@playwright/test'

// Local stack only. Admin password from env (E2E_PASSWORD).
const password = process.env.E2E_PASSWORD ?? ''

async function loginAdmin(page: Page) {
  await page.goto('./')
  await page.getByLabel('Email').fill('admin.dev@test.invalid')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

/** Creates a cheque on the New cheque tab, adding the bank and party from the popups. */
async function createWithQuickAdd(page: Page, id: string) {
  const bank = `Test Bank QA ${id}`
  const party = `Test Party QA ${id}`
  await page.getByRole('menuitem', { name: 'New cheque' }).click()
  await page.getByPlaceholder('e.g. 100-009').fill(`QA${id}`)
  await page.getByLabel('Amount (NPR)').fill('4321')

  await page.getByRole('button', { name: '+ Add bank' }).click()
  const bankDialog = page.getByRole('dialog')
  await bankDialog.getByLabel('Bank name').fill(bank)
  await bankDialog.getByRole('button', { name: 'Add bank' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTitle(bank)).toBeVisible()

  await page.getByRole('button', { name: '+ Add party' }).click()
  const partyDialog = page.getByRole('dialog')
  await partyDialog.getByLabel('Party name').fill(party)
  await partyDialog.getByRole('button', { name: 'Add party' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('input#party')).toHaveValue(party)

  // Typed fields survived both popups.
  await expect(page.getByPlaceholder('e.g. 100-009')).toHaveValue(`QA${id}`)
  await page.getByRole('button', { name: 'Maturity date: set to today' }).click()
  await page.getByRole('button', { name: 'Add cheque' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  return { bank, party }
}

test('admin creates a cheque while adding a new bank and party from the popups', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  const id = `${Date.now().toString().slice(-6)}A`
  await loginAdmin(page)
  const { party } = await createWithQuickAdd(page, id)
  const widget = page.getByTestId('cheque-widget').filter({ hasText: party })
  await expect(widget).toBeVisible()
  await expect(widget).toContainText(`QA${id}`)
})

test('admin edits a cheque number and sees it on the widget', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  const id = `${Date.now().toString().slice(-6)}B`
  await loginAdmin(page)
  const { party } = await createWithQuickAdd(page, id)
  const widget = page.getByTestId('cheque-widget').filter({ hasText: party })
  await widget.getByRole('button', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByPlaceholder('e.g. 100-009')).toHaveValue(`QA${id}`)
  await dialog.getByPlaceholder('e.g. 100-009').fill(`ED${id}`)
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('cheque-widget').filter({ hasText: party })).toContainText(`ED${id}`)
})
