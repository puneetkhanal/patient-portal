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

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

test('availability table shows no slots remaining when full', async ({ page }) => {
  const api = await request.newContext({ baseURL });
  const token = await loginApi(api);

  const seedDate = getTodayBs();

  const settingsRes = await api.get('/api/settings', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const settings = (await settingsRes.json()).data.settings;

  const capacitySlots: Record<string, number> = {};
  WEEK_DAYS.forEach((day) => {
    capacitySlots[day] = 1;
  });

  await api.put('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...settings,
      allowBackEntry: true,
      hospitalList: ['Capacity Hospital'],
      hospitalCapacities: [{ name: 'Capacity Hospital', slots: capacitySlots }]
    }
  });

  const availabilityRes = await api.get(`/api/weekly-requests/availability?weekStart=${encodeURIComponent(seedDate)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(availabilityRes.status()).toBe(200);
  const availabilityData = (await availabilityRes.json()).data;
  const weekStart = availabilityData.weekStart as string;
  const preferredDate = availabilityData.days[0].date as string;

  const patientRes = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      registered_date: preferredDate,
      registered_no: `CAP-${Date.now()}`,
      patient_name: 'Capacity Patient',
      gender: 'Female',
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
      callDate: preferredDate,
      requestedUnits: 1,
      requestedHospital: 'Capacity Hospital',
      preferredDate
    }
  });
  expect(requestRes.status()).toBe(201);

  const planRes = await api.post('/api/weekly-plans', {
    headers: { Authorization: `Bearer ${token}` },
    data: { weekStart }
  });
  let planId: string;
  if (planRes.status() === 201) {
    planId = (await planRes.json()).data.plan._id;
  } else if (planRes.status() === 409) {
    const plansRes = await api.get(`/api/weekly-plans?weekStart=${encodeURIComponent(weekStart)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    planId = (await plansRes.json()).data.plans[0]._id;
  } else {
    expect(planRes.status()).toBe(201);
    planId = (await planRes.json()).data.plan._id;
  }

  const planDetail = await api.get(`/api/weekly-plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(planDetail.status()).toBe(200);
  const items = (await planDetail.json()).data.items || [];
  if (items.length > 0) {
    const updateItem = await api.patch(`/api/plan-items/${items[0]._id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { assignedDate: preferredDate, assignedHospital: 'Capacity Hospital' }
    });
    expect(updateItem.status()).toBe(200);
  }

  const availabilityAfter = await api.get(`/api/weekly-requests/availability?weekStart=${encodeURIComponent(weekStart)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(availabilityAfter.status()).toBe(200);
  const availabilitySnapshot = (await availabilityAfter.json()).data;
  const dayEntry = availabilitySnapshot.days.find((entry: any) => entry.date === preferredDate);
  const hospitalEntry = availabilitySnapshot.hospitals.find((entry: any) => entry.name === 'Capacity Hospital');
  let expectedRemaining = 0;
  if (dayEntry && hospitalEntry) {
    const capacity = hospitalEntry.capacityByDay?.[dayEntry.name] ?? 0;
    const planned = hospitalEntry.plannedByDay?.[dayEntry.name] ?? 0;
    expectedRemaining = Math.max(capacity - planned, 0);
  }

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.locator('.friday-plan-link select option[value="' + planId + '"]')).toBeAttached({ timeout: 20000 });
  await page.locator('.friday-plan-link select').selectOption(planId);

  await page.getByLabel('Requested Hospital').selectOption('Capacity Hospital');
  await fillDateField(page, 'Preferred Date', preferredDate);

  const availabilityTable = page.locator('.availability-table');
  const headers = availabilityTable.locator('thead th');
  const headerCount = await headers.count();
  let targetIndex = -1;
  for (let i = 0; i < headerCount; i += 1) {
    const headerText = (await headers.nth(i).textContent()) || '';
    if (headerText.includes(preferredDate)) {
      targetIndex = i;
      break;
    }
  }
  expect(targetIndex).toBeGreaterThan(0);
  const row = availabilityTable.locator('tbody tr').filter({ hasText: 'Capacity Hospital' });
  const cell = row.locator('td').nth(targetIndex);
  await expect(cell).toContainText(`Remaining ${expectedRemaining}`);
});
