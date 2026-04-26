import { test, expect, request } from '@playwright/test';
import { fillDateField } from './helpers/date-input';
import { getTodayBs } from '../client/src/utils/nepaliDate';

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

test('transfusion confirmation updates plan item status', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const uniqueReg = `CONF-${Date.now()}`;
  const today = getTodayBs();

  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: today,
      registered_no: uniqueReg,
      patient_name: `Confirm Patient ${uniqueReg}`,
      gender: 'Female',
      blood_group: 'O+',
      diagnosed: true
    }
  });
  expect(createPatient.status()).toBe(201);
  const patient = (await createPatient.json()).data.patient;

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
  await page.getByRole('button', { name: /weekly plan/i }).click();
  await page.getByLabel('Plan ID').fill(planId);
  await page.getByRole('button', { name: /load plan/i }).click();

  const row = page.locator('table tr', { hasText: uniqueReg });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: /^confirm$/i }).click();

  const confirmPanel = page.locator('.confirm-panel');
  await expect(confirmPanel).toBeVisible();
  await fillDateField(page, 'Actual Date', today);
  await confirmPanel.locator('input[type="number"]').first().fill('1');
  await confirmPanel.locator('select').first().selectOption('completed');

  const confirmResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/plan-items/') && response.request().method() === 'PATCH';
  });
  await confirmPanel.getByRole('button', { name: /confirm transfusion/i }).click();
  const response = await confirmResponse;
  expect(response.status()).toBe(200);

  await expect(page.getByText('Transfusion confirmed.')).toBeVisible();
});
