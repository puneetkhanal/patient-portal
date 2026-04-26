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

const E2E_FRIDAY = '2026-02-06';

test('reports show shortage and hospital load data', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const reg = `REP-${Date.now()}`;
  const date = E2E_FRIDAY;

  const patientRes = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: date,
      registered_no: reg,
      patient_name: `Report Patient ${reg}`,
      gender: 'Male',
      blood_group: 'AB+',
      diagnosed: true
    }
  });
  expect(patientRes.status()).toBe(201);
  const patient = (await patientRes.json()).data.patient;

  const requestRes = await api.post('/api/weekly-requests', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      patientId: patient._id,
      callDate: date,
      requestedUnits: 2,
      requestedHospital: "General Hospital",
      preferredDate: date
    }
  });
  expect(requestRes.status()).toBe(201);

  const plansRes = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const planEntry = (await plansRes.json()).data.plans[0];
  const planId = planEntry._id;
  const weekStartLabel = planEntry.weekStart.slice(0, 10);

  const planDetails = await api.get(`/api/weekly-plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const item = (await planDetails.json()).data.items[0];

  const confirm = await api.patch(`/api/plan-items/${item._id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      actualDate: date,
      unitsTransfused: 1,
      outcome: 'completed'
    }
  });
  expect(confirm.status()).toBe(200);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /analytics/i }).click();
  await page.getByRole('button', { name: /load reports/i }).click();

  const shortageSection = page.getByRole('heading', { name: /shortage analysis/i }).locator('..');
  await expect(shortageSection).toBeVisible();
  await expect(shortageSection.locator('tbody tr', { hasText: weekStartLabel }).first()).toBeVisible();

  const hospitalSection = page.getByRole('heading', { name: /hospital load/i }).locator('..');
  await expect(hospitalSection).toBeVisible();
  await expect(hospitalSection.locator('tbody tr', { hasText: "General Hospital" }).first()).toBeVisible();
});
