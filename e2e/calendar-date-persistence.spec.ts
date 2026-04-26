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

async function setCalendarMode(api: ReturnType<typeof request.newContext>, token: string, mode: 'AD' | 'BS') {
  const response = await api.put('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
    data: { calendarMode: mode }
  });
  expect(response.status()).toBe(200);
}

async function loginAsAdmin(page: Parameters<typeof test>[0]['page']) {
  await page.goto(baseURL);
  await page.getByLabel('Email or Username').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test('date is saved, retrieved, and displayed in UI', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);
  await setCalendarMode(api, token, 'AD');

  const regNo = `CAL-${Date.now()}`;
  const dob = '2026-02-07';

  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: dob,
      registered_no: regNo,
      patient_name: `Calendar Test ${regNo}`,
      dob,
      gender: 'Female',
      blood_group: 'A+',
      diagnosed: false
    }
  });
  expect(createPatient.status()).toBe(201);

  await loginAsAdmin(page);
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  const formattedDob = dob;

  const row = page.getByRole('row', { name: new RegExp(regNo) });
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row).toContainText(formattedDob);

  await row.getByRole('button', { name: new RegExp(regNo) }).click();
  await expect(page.getByRole('heading', { name: new RegExp(regNo) })).toBeVisible();
  await expect(page.getByText('Date of Birth')).toBeVisible();
  const dobRow = page.getByText('Date of Birth').locator('..');
  await expect(dobRow).toContainText(formattedDob);
});
