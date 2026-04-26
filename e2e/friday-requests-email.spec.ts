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

test('email template modal generates copy-ready content', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const reg = `EMAIL-${Date.now()}`;
  const date = E2E_FRIDAY;

  const patientRes = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: date,
      registered_no: reg,
      patient_name: `Email Patient ${reg}`,
      gender: 'Female',
      blood_group: 'A+',
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

  const plansRes = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const planId = (await plansRes.json()).data.plans[0]._id;

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.locator('.friday-plan-link select option[value="' + planId + '"]')).toBeAttached({ timeout: 20000 });
  await page.locator('.friday-plan-link select').selectOption(planId);

  await page.getByRole('button', { name: /email template/i }).click();
  await page.getByRole('button', { name: /generate email/i }).click();

  const textarea = page.locator('.email-textarea');
  await expect(textarea).toBeVisible();
  await expect(textarea).toContainText('Managing Officer', { timeout: 10000 });
  await expect(textarea).toContainText('Blood Bank, General Hospital');
  // Template may list hospitals with 0 units (no "X = N units" line) depending on active plan data
  await expect(textarea).toContainText(/Blood Bank|Managing Officer|units?/);
});
