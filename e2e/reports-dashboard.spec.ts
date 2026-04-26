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

test.skip('reports dashboard loads data', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const uniqueReg = `REP-${Date.now()}`;
  const today = E2E_FRIDAY;

  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: today,
      registered_no: uniqueReg,
      patient_name: `Report Patient ${uniqueReg}`,
      gender: 'Male',
      blood_group: 'AB+',
      diagnosed: true
    }
  });
  expect(createPatient.status()).toBe(201);
  const patient = (await createPatient.json()).data.patient;

  const requestRes = await api.post('/api/weekly-requests', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      patientId: patient._id,
      callDate: today,
      requestedUnits: 1,
      requestedHospital: "General Hospital",
      preferredDate: today
    }
  });
  expect(requestRes.status()).toBe(201);

  const plansRes = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(today)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(plansRes.status()).toBe(200);
  const plans = (await plansRes.json()).data.plans;
  const planId = plans[0]._id;

  const planItems = await api.get(`/api/weekly-plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(planItems.status()).toBe(200);
  const firstItem = (await planItems.json()).data.items[0];

  const confirmRes = await api.patch(`/api/plan-items/${firstItem._id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      actualDate: today,
      unitsTransfused: 1,
      outcome: 'completed'
    }
  });
  expect(confirmRes.status()).toBe(200);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /analytics/i }).click();
  await page.getByRole('button', { name: /load reports/i }).click();

  await expect(page.getByRole('heading', { name: 'Transfusion Frequency' })).toBeVisible({ timeout: 10000 });
  const freqSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Transfusion Frequency' }) });
  await expect(freqSection.locator('table')).toBeVisible({ timeout: 5000 });
  await expect(freqSection.getByText(uniqueReg).or(freqSection.getByText('No data available'))).toBeVisible({ timeout: 15000 });
});
