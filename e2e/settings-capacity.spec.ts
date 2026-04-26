import { test, expect } from '@playwright/test';

const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function login(page: Parameters<typeof test>[0]['page'], email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Email or Username').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test('hospital capacity values persist after saving', async ({ page }) => {
  await login(page, adminEmail, adminPassword);

  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: /system settings/i })).toBeVisible();

  await page.getByLabel('Hospitals (one per line)').fill('Capacity Hospital');

  const capacityRow = page.locator('.settings-form__capacity-row', { hasText: 'Capacity Hospital' });
  const mondayInput = capacityRow.locator('input').nth(1);
  await mondayInput.fill('5');

  await page.getByRole('button', { name: /save settings/i }).click();
  await expect(page.getByText('Settings saved successfully')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /settings/i }).click();

  await expect(page.getByRole('heading', { name: /system settings/i })).toBeVisible();
  const rowAfterReload = page.locator('.settings-form__capacity-row').filter({ hasText: 'Capacity Hospital' });
  await expect(rowAfterReload).toBeVisible({ timeout: 10000 });
  const mondayAfterReload = rowAfterReload.locator('input').nth(1);
  await expect(mondayAfterReload).toHaveValue('5', { timeout: 10000 });
});
