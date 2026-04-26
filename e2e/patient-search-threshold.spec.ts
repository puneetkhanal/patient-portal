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

test('patient search requires 3+ chars for fuzzy match', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const regNo = `TH-${Date.now()}`;
  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: new Date().toISOString().split('T')[0],
      registered_no: regNo,
      patient_name: 'Sample Patient',
      gender: 'Male',
      blood_group: 'A+',
      diagnosed: false
    }
  });
  expect(createPatient.status()).toBe(201);

  await loginAsAdmin(page);

  const searchInput = page.getByLabel('Search', { exact: true });
  await searchInput.fill('js');
  await expect(page.getByText('No patients match your search.')).toBeVisible();

  await searchInput.fill('sam');
  const row = page.getByRole('row', { name: new RegExp(regNo, 'i') });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Sample Patient');
});
