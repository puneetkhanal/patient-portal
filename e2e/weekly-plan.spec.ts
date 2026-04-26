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

test('weekly plan can be created and edited from UI', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const uniqueReg = `PLAN-${Date.now()}`;
  const today = '2026-02-06';
  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: today,
      registered_no: uniqueReg,
      patient_name: `Plan Patient ${uniqueReg}`,
      gender: 'Female',
      blood_group: 'B+',
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
  const planId = (await plansRes.json()).data.plans[0]._id;

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /weekly plan/i }).click();

  await expect(page.getByRole('heading', { name: /previous plans/i })).toBeVisible();
  await page.getByLabel('Plan ID').fill(planId);
  await page.getByRole('button', { name: /load plan/i }).click();

  const row = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(row).toBeVisible({ timeout: 15000 });

  const hospitalSelect = row.locator('select').first();
  await expect(hospitalSelect.locator('option')).not.toHaveCount(0, { timeout: 10000 });
  const hospitalOptionCount = await hospitalSelect.locator('option').count();
  if (hospitalOptionCount >= 2) {
    await hospitalSelect.selectOption({ index: 1 });
  } else {
    const unitsSelect = row.locator('select').nth(1);
    await unitsSelect.selectOption('2');
  }

  const saveResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/plan-items/') && response.request().method() === 'PATCH';
  });
  await row.getByRole('button', { name: /save/i }).click();
  const updateResponse = await saveResponse;
  expect(updateResponse.status()).toBe(200);

  await expect(page.getByText('Plan item updated.')).toBeVisible();
});
