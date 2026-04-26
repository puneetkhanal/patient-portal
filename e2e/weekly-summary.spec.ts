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

test('weekly summary loads for a plan', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const uniqueReg = `SUM-${Date.now()}`;
  const today = '2026-02-06';

  let planId: string;
  const planRes = await api.post('/api/weekly-plans', {
    headers: { Authorization: `Bearer ${token}` },
    data: { weekStart: today }
  });
  if (planRes.status() === 201) {
    planId = (await planRes.json()).data.plan._id;
  } else if (planRes.status() === 409) {
    const getPlans = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(today)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(getPlans.status()).toBe(200);
    planId = (await getPlans.json()).data.plans[0]._id;
  } else {
    expect(planRes.status()).toBe(201);
    planId = (await planRes.json()).data.plan._id;
  }

  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: today,
      registered_no: uniqueReg,
      patient_name: `Summary Patient ${uniqueReg}`,
      gender: 'Male',
      blood_group: 'A+',
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

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /weekly summary/i }).click();

  await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /refresh/i }).click();
  const planRow = page.getByRole('row', { name: new RegExp(planId) });
  await expect(planRow).toBeVisible({ timeout: 15000 });
  const summaryResponse = page.waitForResponse((response) => {
    return response.url().includes(`/api/weekly-plans/${planId}/summary`) && response.request().method() === 'GET';
  });
  await planRow.getByRole('button', { name: /view summary/i }).click();
  await summaryResponse;

  await expect(page.getByText('Total Units:')).toBeVisible();
  await expect(page.getByRole('heading', { name: /by blood group/i })).toBeVisible();
});
