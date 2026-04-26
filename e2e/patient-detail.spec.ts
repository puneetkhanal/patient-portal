import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

test('patient detail shows photo and documents after clicking from list', async ({ page }) => {
  test.setTimeout(60_000);

  const api = await request.newContext({ baseURL });

  const login = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(login.status()).toBe(200);
  const adminToken = (await login.json()).token;

  const regNo = `E2E-DETAIL-${Date.now()}`;
  const registeredDate = new Date().toISOString().split('T')[0];
  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      registered_date: registeredDate,
      registered_no: regNo,
      patient_name: 'E2E Detail Patient',
      gender: 'Female',
      blood_group: 'B+',
      diagnosed: false
    }
  });
  expect(createPatient.status()).toBe(201);
  const patientId = (await createPatient.json()).data.patient._id;

  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );

  const uploadPhoto = await api.post(`/api/patients/${patientId}/documents`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    multipart: {
      documentType: 'patient_photo',
      issuingAuthority: 'E2E',
      file: {
        name: 'patient-photo.png',
        mimeType: 'image/png',
        buffer: pngBuffer
      }
    }
  });
  expect(uploadPhoto.status()).toBe(201);

  const uploadReport = await api.post(`/api/patients/${patientId}/documents`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    multipart: {
      documentType: 'diagnosis_report',
      issuingAuthority: 'E2E Hospital',
      file: {
        name: 'diagnosis-report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 E2E report')
      }
    }
  });
  expect(uploadReport.status()).toBe(201);

  await page.goto('/');
  await page.getByLabel('Email or Username').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByLabel('Search').fill(regNo);
  const row = page.getByRole('row', { name: new RegExp(regNo) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: new RegExp(regNo) }).click();

  await expect(page.getByRole('heading', { name: /e2e detail patient/i })).toBeVisible();
  await expect(page.getByText(`Reg. No: ${regNo}`)).toBeVisible();
  await expect(page.getByText('Gender')).toBeVisible();
  await expect(page.getByText('Female')).toBeVisible();
  await expect(page.getByText('Blood Group')).toBeVisible();
  await expect(page.getByText('B+')).toBeVisible();
  await expect(page.getByText('Diagnosed', { exact: true })).toBeVisible();
  const diagnosedValue = page
    .getByText('Diagnosed', { exact: true })
    .locator('..')
    .locator('strong');
  await expect(diagnosedValue).toHaveText('No');
  const expectedRegisteredDate = registeredDate;
  await expect(page.getByText('Registered')).toBeVisible();
  await expect(page.getByText(expectedRegisteredDate)).toBeVisible();

  const photo = page.getByRole('img', { name: /patient/i });
  await expect(photo).toBeVisible();
  const photoSrc = await photo.getAttribute('src');
  expect(photoSrc).toBeTruthy();
  expect(photoSrc?.startsWith('blob:')).toBe(true);

  await expect(page.getByText('patient photo')).toBeVisible();
  await expect(page.getByText('diagnosis report')).toBeVisible();
  await expect(page.getByText('patient-photo.png')).toBeVisible();
  await expect(page.getByText('diagnosis-report.pdf')).toBeVisible();

  const reportCard = page.locator('.patient-detail__doc', { hasText: 'diagnosis report' });
  const download = page.waitForEvent('download');
  await reportCard.getByRole('button', { name: /download/i }).click();
  const reportDownload = await download;
  expect(reportDownload.suggestedFilename()).toBe('diagnosis-report.pdf');
  const reportPath = await reportDownload.path();
  expect(reportPath).toBeTruthy();
  if (reportPath) {
    const reportBuffer = await (await import('fs')).promises.readFile(reportPath);
    expect(reportBuffer.subarray(0, 4).toString()).toBe('%PDF');
  }
});
