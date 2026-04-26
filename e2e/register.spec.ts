import { test, expect } from '@playwright/test';
import { fillDateField } from './helpers/date-input';
import { getTodayBs } from '../client/src/utils/nepaliDate';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test('user can register and then login', async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-register-${suffix}@example.test`;
  const password = `Pass-${suffix}`;

  await page.goto(baseURL);
  await page.getByRole('button', { name: /sign up/i }).click();

  await page.getByLabel('Name', { exact: true }).fill(`E2E Register ${suffix}`);
  await page.getByLabel('Email or Username').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign up$/i }).click();

  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();
  await page.getByRole('button', { name: /logout/i }).click();

  await page.getByLabel('Email or Username').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();
});

test('admin can register patient with documents from UI', async ({ page }) => {
  const regNo = `DOC-${Date.now()}`;
  await page.goto(baseURL);
  await page.getByLabel('Email or Username').fill('admin@example.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('button', { name: /\+ register new patient/i }).click();

  const today = getTodayBs();
  await fillDateField(page, 'Registered Date', today);
  await page.locator('#registered_no').fill(regNo);
  await page.locator('#patient_name').fill('E2E Doc Register');
  await page.locator('#gender').selectOption('Male');
  await page.locator('#blood_group').selectOption('A+');

  const docRow = page.locator('.document-row').first();
  await docRow.getByLabel('Document Type').selectOption('diagnosis_report');
  await docRow.getByLabel('Issuing Authority').fill('E2E Hospital');
  await docRow.getByLabel('File').setInputFiles({
    name: 'e2e-report.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 E2E')
  });

  const createResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/patients') && response.request().method() === 'POST';
  });
  const uploadResponse = page.waitForResponse((response) => {
    return response.url().includes('/documents') && response.request().method() === 'POST';
  });

  await page.getByRole('button', { name: /register patient/i }).click();
  await createResponse;
  await uploadResponse;

  await expect(page.getByRole('button', { name: /\+ register new patient/i })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(regNo) })).toBeVisible();
});

test('registration rejects invalid document upload type', async ({ page }) => {
  const regNo = `DOC-INVALID-${Date.now()}`;
  await page.goto(baseURL);
  await page.getByLabel('Email or Username').fill('admin@example.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('button', { name: /\+ register new patient/i }).click();

  const today = getTodayBs();
  await fillDateField(page, 'Registered Date', today);
  await page.locator('#registered_no').fill(regNo);
  await page.locator('#patient_name').fill('E2E Invalid Doc');
  await page.locator('#gender').selectOption('Female');
  await page.locator('#blood_group').selectOption('B+');

  const docRow = page.locator('.document-row').first();
  await docRow.getByLabel('Document Type').selectOption('diagnosis_report');
  await docRow.getByLabel('File').setInputFiles({
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not allowed')
  });

  await page.getByRole('button', { name: /register patient/i }).click();
  await expect(page.locator('.error-message')).toBeVisible();
  await expect(page.locator('.error-message')).toContainText(
    /failed to upload documents|invalid file type|invalid document type|no file uploaded/i
  );
});
