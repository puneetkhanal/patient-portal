import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

test('session persists after reload with valid token', async ({ page }) => {
  await page.goto(baseURL);
  await page.getByLabel('Email or Username').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
});

test('invalid token in storage forces logout', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'invalid-token');
    localStorage.setItem('auth_user', JSON.stringify({ email: 'fake@user.test' }));
  });

  await page.goto(baseURL);
  await expect(page.getByLabel('Email or Username')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /logout/i })).toHaveCount(0);
});
