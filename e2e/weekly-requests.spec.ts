import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function loginApi(api: ReturnType<typeof request.newContext>, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
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

const E2E_FRIDAY = '2026-02-06';

test('weekly requests created via API appear in Friday calls UI', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const adminToken = await loginApi(api, adminEmail, adminPassword);
  await setCalendarMode(api, adminToken, 'AD');

  const planDate = E2E_FRIDAY;
  let planId: string;
  const planRes = await api.post('/api/weekly-plans', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { weekStart: planDate }
  });
  if (planRes.status() === 201) {
    planId = (await planRes.json()).data.plan._id;
  } else if (planRes.status() === 409) {
    const getPlans = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(planDate)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(getPlans.status()).toBe(200);
    planId = (await getPlans.json()).data.plans[0]._id;
  } else {
    expect(planRes.status()).toBe(201);
    planId = (await planRes.json()).data.plan._id;
  }

  const uniqueReg = `WR-${Date.now()}`;
  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      registered_date: planDate,
      registered_no: uniqueReg,
      patient_name: `Weekly Request ${uniqueReg}`,
      gender: 'Male',
      blood_group: 'A+',
      diagnosed: true
    }
  });
  expect(createPatient.status()).toBe(201);

  const createRequest = await api.post('/api/weekly-requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      patientId: (await createPatient.json()).data.patient._id,
      callDate: planDate,
      requestedUnits: 1,
      requestedHospital: 'General Hospital',
      preferredDate: planDate
    }
  });
  expect(createRequest.status()).toBe(201);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.locator('.friday-plan-link select option[value="' + planId + '"]')).toBeAttached({ timeout: 20000 });
  await page.locator('.friday-plan-link select').selectOption(planId);
  await expect(page.getByLabel('Patient Search')).toBeVisible();

  await page.getByLabel('Patient Search').fill(uniqueReg);
  const row = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/planned/i);
});
