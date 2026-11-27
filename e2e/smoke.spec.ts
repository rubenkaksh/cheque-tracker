import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('./');
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection Desk: sign in' })).toBeVisible();
});
