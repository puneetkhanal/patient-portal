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

test('super admin can delete a transfusion record from UI', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const reg = `REC-DEL-${Date.now()}`;
  const date = E2E_FRIDAY;

  const patientRes = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: date,
      registered_no: reg,
      patient_name: `Record Patient ${reg}`,
      gender: 'Male',
      blood_group: 'O+',
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
      requestedUnits: 1,
      requestedHospital: "General Hospital",
      preferredDate: date
    }
  });
  expect(requestRes.status()).toBe(201);
  const requestDoc = (await requestRes.json()).data.request as { _id: string };

  const plansRes = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(plansRes.status()).toBe(200);
  const planId = (await plansRes.json()).data.plans[0]._id;

  const planDetails = await api.get(`/api/weekly-plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const items = (await planDetails.json()).data.items as Array<{ _id: string; requestId: string }>;
  const item = items.find((entry) => String(entry.requestId) === String(requestDoc._id));
  expect(item).toBeTruthy();

  const confirmRes = await api.patch(`/api/plan-items/${item!._id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      actualDate: date,
      unitsTransfused: 1,
      outcome: 'completed'
    }
  });
  expect(confirmRes.status()).toBe(200);
  await page.waitForTimeout(500);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /confirmation/i }).click();

  await expect(page.getByRole('heading', { name: /transfusion records/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /refresh records/i })).toBeVisible({ timeout: 10000 });
  const recordsResponse = page.waitForResponse((res) => res.url().includes('/api/transfusion-records') && res.request().method() === 'GET');
  await page.getByRole('button', { name: /refresh records/i }).click();
  await recordsResponse;
  await page.waitForTimeout(500);
  const table = page.locator('.transfusion-confirmation-container table');
  await expect(table.getByText(patient.patient_name).or(table.getByText(String(patient._id)))).toBeVisible({ timeout: 15000 });
  const row = table.locator('tbody tr').filter({ hasText: new RegExp(patient.patient_name + '|' + String(patient._id)) });
  await row.scrollIntoViewIfNeeded();

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /delete/i }).click();

  await expect(page.getByText(/transfusion record deleted/i)).toBeVisible();
  await expect(table.getByText(patient.patient_name).or(table.getByText(String(patient._id)))).not.toBeVisible();
});
