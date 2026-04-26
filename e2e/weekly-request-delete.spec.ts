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

async function createPatient(api: ReturnType<typeof request.newContext>, token: string, regNo: string, date: string) {
  const res = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: date,
      registered_no: regNo,
      patient_name: `Request Delete ${regNo}`,
      gender: 'Female',
      blood_group: 'B+',
      diagnosed: true
    }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data.patient;
}

async function createWeeklyRequest(api: ReturnType<typeof request.newContext>, token: string, patientId: string, date: string) {
  const res = await api.post('/api/weekly-requests', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      patientId,
      callDate: date,
      requestedUnits: 1,
      requestedHospital: "General Hospital",
      preferredDate: date
    }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data.request as { _id: string };
}

async function getPlanForDate(api: ReturnType<typeof request.newContext>, token: string, date: string) {
  const res = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.status()).toBe(200);
  const plans = (await res.json()).data.plans as Array<{ _id: string; weekStart: string; weekEnd: string }>;
  return plans[0];
}

test('weekly request can be deleted from Friday Requests UI', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const date = E2E_FRIDAY;
  const reg = `REQ-DEL-${Date.now()}`;
  const patient = await createPatient(api, token, reg, date);
  await createWeeklyRequest(api, token, patient._id, date);
  const plan = await getPlanForDate(api, token, date);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.locator('.friday-plan-link select option[value="' + plan._id + '"]')).toBeAttached({ timeout: 20000 });
  await page.locator('.friday-plan-link select').selectOption(plan._id);

  const row = page.getByRole('row', { name: new RegExp(reg) });
  await expect(row).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /delete/i }).click();

  await expect(page.getByText('Weekly request deleted.')).toBeVisible();
  await expect(row).toBeHidden();
});

test('weekly request delete blocked when transfusion record exists', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  // Use a different week than the first test to avoid 400 (e.g. validation/state from same week)
  const date = '2026-02-13';
  const reg = `REQ-BLOCK-${Date.now()}`;
  const patient = await createPatient(api, token, reg, date);
  const requestDoc = await createWeeklyRequest(api, token, patient._id, date);
  const plan = await getPlanForDate(api, token, date);

  const planDetails = await api.get(`/api/weekly-plans/${plan._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(planDetails.status()).toBe(200);
  const items = (await planDetails.json()).data.items as Array<{ _id: string; requestId: string }>;
  const item = items.find((entry) => String(entry.requestId) === String(requestDoc._id));
  expect(item).toBeTruthy();

  const confirm = await api.patch(`/api/plan-items/${item!._id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      actualDate: date,
      unitsTransfused: 1,
      outcome: 'completed'
    }
  });
  expect(confirm.status()).toBe(200);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.locator('.friday-plan-link select option[value="' + plan._id + '"]')).toBeAttached({ timeout: 20000 });
  await page.locator('.friday-plan-link select').selectOption(plan._id);

  const row = page.getByRole('row', { name: new RegExp(reg) });
  await expect(row).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /delete/i }).click();

  // Delete should be blocked: row remains and no success message
  await page.waitForTimeout(3000);
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Weekly request deleted.')).not.toBeVisible();
});
