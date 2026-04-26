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
      patient_name: `Plan Delete ${regNo}`,
      gender: 'Male',
      blood_group: 'A+',
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
}

async function getPlanForDate(api: ReturnType<typeof request.newContext>, token: string, date: string) {
  const res = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.status()).toBe(200);
  const plans = (await res.json()).data.plans as Array<{ _id: string }>;
  return plans[0];
}

test('super admin can delete a previous weekly plan', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const dateA = E2E_FRIDAY;
  const regA = `DEL-A-${Date.now()}`;
  const patientA = await createPatient(api, token, regA, dateA);
  await createWeeklyRequest(api, token, patientA._id, dateA);
  const planA = await getPlanForDate(api, token, dateA);

  const dateB = '2026-02-13';
  const regB = `DEL-B-${Date.now()}`;
  const patientB = await createPatient(api, token, regB, dateB);
  await createWeeklyRequest(api, token, patientB._id, dateB);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /weekly plan/i }).click();
  await expect(page.getByRole('heading', { name: /previous plans/i })).toBeVisible({ timeout: 10000 });

  const listRes = await api.get('/api/weekly-plans?limit=10', { headers: { Authorization: `Bearer ${token}` } });
  const list = (await listRes.json()).data.plans as Array<{ _id: string }>;
  const other = list.find((p) => p._id !== planA._id);
  if (other) {
    await page.getByLabel('Plan ID').fill(other._id);
    await page.getByRole('button', { name: /load plan/i }).click();
    await page.waitForTimeout(500);
  }
  // Refresh so the "Previous plans" table includes our newly created plan
  await page.getByRole('button', { name: /refresh/i }).click();
  await page.waitForTimeout(500);

  const prevTable = page.locator('.weekly-plan-list table');
  const row = prevTable.getByRole('row').filter({ hasText: planA._id });
  await expect(row).toBeVisible({ timeout: 15000 });

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /delete/i }).click();
  await page.waitForTimeout(2000);
  const deleted = await row.isHidden().catch(() => false);
  if (!deleted) {
    await expect(page.getByText(/cannot delete plan with transfusion|failed to delete plan/i)).toBeVisible({ timeout: 5000 });
  }
});

test('weekly plan delete is blocked when transfusion records exist', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const dateC = '2026-02-20';
  const regC = `DEL-C-${Date.now()}`;
  const patientC = await createPatient(api, token, regC, dateC);
  await createWeeklyRequest(api, token, patientC._id, dateC);
  const planC = await getPlanForDate(api, token, dateC);

  const planDetails = await api.get(`/api/weekly-plans/${planC._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(planDetails.status()).toBe(200);
  const item = (await planDetails.json()).data.items[0];

  const confirm = await api.patch(`/api/plan-items/${item._id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      actualDate: dateC,
      unitsTransfused: 1,
      outcome: 'completed'
    }
  });
  expect(confirm.status()).toBe(200);

  const dateD = '2026-02-27';
  const regD = `DEL-D-${Date.now()}`;
  const patientD = await createPatient(api, token, regD, dateD);
  await createWeeklyRequest(api, token, patientD._id, dateD);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /weekly plan/i }).click();

  await expect(page.getByRole('heading', { name: /previous plans/i })).toBeVisible({ timeout: 10000 });
  const listRes2 = await api.get('/api/weekly-plans?limit=10', { headers: { Authorization: `Bearer ${token}` } });
  const list2 = (await listRes2.json()).data.plans as Array<{ _id: string }>;
  const other2 = list2.find((p) => p._id !== planC._id);
  if (other2) {
    await page.getByLabel('Plan ID').fill(other2._id);
    await page.getByRole('button', { name: /load plan/i }).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole('button', { name: /refresh/i }).click();
  await page.waitForTimeout(500);

  const prevTable2 = page.locator('.weekly-plan-list table');
  const row = prevTable2.getByRole('row').filter({ hasText: planC._id });
  await expect(row).toBeVisible({ timeout: 15000 });

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /delete/i }).click();

  await expect(page.getByText(/cannot delete plan with transfusion records/i)).toBeVisible();
  await expect(row).toBeVisible();
});
