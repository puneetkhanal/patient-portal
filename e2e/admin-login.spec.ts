import { test, expect } from '@playwright/test';
import { fillDateField } from './helpers/date-input';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function loginAsAdmin(page: Parameters<typeof test>[0]['page']) {
  await page.goto(baseURL);
  await page.getByLabel('Email or Username').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
}

async function loginApi() {
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  if (!response.ok) {
    throw new Error(`API login failed: ${response.status}`);
  }
  const body = await response.json();
  return body.token as string;
}

async function createPatient(token: string, regNo: string, patientName: string) {
  const response = await fetch(`${baseURL}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      registered_date: new Date().toISOString().split('T')[0],
      registered_no: regNo,
      patient_name: patientName,
      gender: 'Male',
      blood_group: 'A+',
      diagnosed: false
    })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Create patient failed: ${response.status} ${JSON.stringify(body)}`);
  }
}

async function openRegisterForm(page: Parameters<typeof test>[0]['page']) {
  await page.getByRole('button', { name: /dashboard/i }).click();
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();
  const addButton = page.getByRole('button', { name: /\+ register new patient/i });
  const emptyButton = page.getByRole('button', { name: /register first patient/i });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.locator('#registered_no').isVisible().catch(() => false)) {
      return;
    }
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click({ force: true });
    } else if (await emptyButton.isVisible().catch(() => false)) {
      await emptyButton.click({ force: true });
    }
    await page.waitForTimeout(300);
  }

  await expect(page.locator('#registered_no')).toBeVisible();
}

test('super admin can login with email and password', async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.locator('.user-name').getByText('Admin', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
});

test('super admin can add a patient and see it in the list', async ({ page }) => {
  const token = await loginApi();
  const uniqueReg = `E2E-${Date.now()}`;
  await createPatient(token, uniqueReg, 'E2E Patient');

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /dashboard/i }).click();
  await page.getByLabel('Search', { exact: true }).fill(uniqueReg);

  const row = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(row).toBeVisible();
  await expect(row.getByText('E2E Patient')).toBeVisible();
});

test('super admin can update a patient and see persisted changes', async ({ page }) => {
  test.setTimeout(60_000);
  const token = await loginApi();
  const uniqueReg = `E2E-EDIT-${Date.now()}`;
  const uniqueName = `E2E Patient Edit ${Date.now()}`;
  await createPatient(token, uniqueReg, uniqueName);

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /dashboard/i }).click();
  await page.getByLabel('Search', { exact: true }).fill(uniqueReg);

  const row = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(row).toBeVisible();
  await row.locator('button[title="Edit patient"]').click();
  await expect(page.getByRole('heading', { name: /edit patient/i })).toBeVisible();
  await expect(page.locator('#patient_name')).toBeVisible();
  await page.locator('#patient_name').fill('E2E Patient Updated');
  await fillDateField(page, 'Date of Birth', '2026-02-07');
  const updateButton = page.getByRole('button', { name: /update patient/i });
  await updateButton.scrollIntoViewIfNeeded();

  let updateResponse;
  try {
    const updateRequest = page.waitForRequest(
      (request) => request.url().includes('/api/patients/') && request.method() === 'PUT',
      { timeout: 10_000 }
    );
    await updateButton.click({ force: true });
    const request = await updateRequest;
    updateResponse = await request.response();
  } catch {
    const errorBox = page.locator('.error-message');
    if (await errorBox.isVisible()) {
      const message = await errorBox.textContent();
      throw new Error(`Update patient failed: ${message?.trim()}`);
    }
    throw new Error('Update patient failed: no response received');
  }

  if (updateResponse.status() !== 200) {
    const body = await updateResponse.json().catch(() => ({}));
    throw new Error(`Update patient failed: ${updateResponse.status()} ${JSON.stringify(body)}`);
  }

  await expect(page.getByRole('button', { name: /\+ register new patient/i })).toBeVisible();

  const updatedRow = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(updatedRow).toBeVisible();
  await expect(updatedRow.getByText('E2E Patient Updated')).toBeVisible();

  await page.reload();
  const persistedRow = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(persistedRow).toBeVisible();
  await expect(persistedRow.getByText('E2E Patient Updated')).toBeVisible();
});

test('super admin can delete a patient and it is removed from the list', async ({ page }) => {
  const token = await loginApi();
  const uniqueReg = `E2E-DEL-${Date.now()}`;
  await createPatient(token, uniqueReg, 'E2E Patient Delete');

  await loginAsAdmin(page);
  await page.getByRole('button', { name: /dashboard/i }).click();
  await page.getByLabel('Search', { exact: true }).fill(uniqueReg);

  const row = page.getByRole('row', { name: new RegExp(uniqueReg) });
  await expect(row).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await row.locator('button.btn-danger').click();

  await expect(page.getByRole('row', { name: new RegExp(uniqueReg) })).toHaveCount(0);
});
