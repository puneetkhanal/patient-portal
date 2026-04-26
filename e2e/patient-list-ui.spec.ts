import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function loginApi(api: ReturnType<typeof request.newContext>) {
  const response = await api.post('/api/auth/login', { data: { email: adminEmail, password: adminPassword } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.token as string;
}

async function loginAsAdmin(page: Parameters<typeof test>[0]['page']) {
  await page.goto(baseURL);
  await page.getByLabel('Email or Username').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test('patients list search and pagination work in UI', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const suffix = Date.now();
  for (let i = 1; i <= 12; i += 1) {
    const res = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        registered_no: `UI-${suffix}-${String(i).padStart(3, '0')}`,
        patient_name: `UI Patient ${i}`,
        gender: 'Male',
        blood_group: 'A+',
        diagnosed: false
      }
    });
    expect(res.status()).toBe(201);
  }

  await loginAsAdmin(page);

  const searchInput = page.getByLabel('Search', { exact: true });
  await searchInput.fill(`UI-${suffix}-00`);

  await expect(page.getByText(/showing/i)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`UI-${suffix}-001`) })).toBeVisible();

  const rowsPerPage = page.getByLabel('Rows per page');
  await rowsPerPage.selectOption('5');
  await expect(page.getByText('Showing 1-5 of 10')).toBeVisible();
  await expect(page.getByRole('button', { name: /previous/i })).toBeDisabled();

  await page.getByRole('button', { name: /next/i }).click();
  await expect(page.getByText('Showing 6-10 of 10')).toBeVisible();
});
