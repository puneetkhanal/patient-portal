import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

type RoleKey = 'data_entry' | 'medical_reviewer' | 'analyst';

const roleLabels: Record<RoleKey, string> = {
  data_entry: 'Data Entry',
  medical_reviewer: 'Medical Reviewer',
  analyst: 'Analyst'
};

async function loginApi(api: ReturnType<typeof request.newContext>, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.token as string;
}

async function createRoleUser(
  api: ReturnType<typeof request.newContext>,
  adminToken: string,
  role: RoleKey,
  suffix: string
) {
  const email = `e2e-${role}-${suffix}@example.test`;
  const tempPassword = `Temp-${suffix}`;
  const newPassword = `Pass-${suffix}`;

  const created = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email,
      name: `E2E ${roleLabels[role]}`,
      role,
      tempPassword
    }
  });
  expect(created.status()).toBe(201);

  const tempToken = await loginApi(api, email, tempPassword);
  const changed = await api.post('/api/auth/change-password', {
    headers: { Authorization: `Bearer ${tempToken}` },
    data: { currentPassword: tempPassword, newPassword }
  });
  expect(changed.status()).toBe(200);

  return { email, password: newPassword };
}

test.describe.skip('Role access inventory (UI + API)', () => {
  const roleCredentials = new Map<RoleKey, { email: string; password: string; token: string }>();
  let patientId = '';
  let documentId = '';
  let regNo = '';

  test.beforeAll(async () => {
    const api = await request.newContext({ baseURL });
    const adminToken = await loginApi(api, adminEmail, adminPassword);

    const suffix = Date.now().toString();
    regNo = `E2E-ROLE-${suffix}`;

    const createPatient = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        registered_no: regNo,
        patient_name: `E2E Role Patient ${suffix}`,
        gender: 'Female',
        blood_group: 'A+',
        diagnosed: false
      }
    });
    expect(createPatient.status()).toBe(201);
    patientId = (await createPatient.json()).data.patient._id;

    const upload = await api.post(`/api/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        documentType: 'diagnosis_report',
        issuingAuthority: 'E2E',
        file: {
          name: 'role-access-report.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 role access')
        }
      }
    });
    expect(upload.status()).toBe(201);
    documentId = (await upload.json()).data.document._id;

    for (const role of Object.keys(roleLabels) as RoleKey[]) {
      const creds = await createRoleUser(api, adminToken, role, suffix);
      const token = await loginApi(api, creds.email, creds.password);
      roleCredentials.set(role, { ...creds, token });
    }
  });

  test('super admin UI shows admin links and patient actions', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email or Username').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('button', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(regNo) });
    await expect(row).toBeVisible();
    await expect(row.locator('button.btn-info')).toBeVisible();
    await expect(row.locator('button.btn-danger')).toBeVisible();
  });

  test('data entry UI hides admin links and edit/delete actions', async ({ page }) => {
    const creds = roleCredentials.get('data_entry');
    expect(creds).toBeTruthy();

    await page.goto('/');
    await page.getByLabel('Email or Username').fill(creds!.email);
    await page.getByLabel('Password').fill(creds!.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('button', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add User' })).toHaveCount(0);

    const row = page.getByRole('row', { name: new RegExp(regNo) });
    await expect(row).toBeVisible();
    await expect(row.getByText('No access')).toBeVisible();
  });

  test('medical reviewer UI hides admin links and edit/delete actions', async ({ page }) => {
    const creds = roleCredentials.get('medical_reviewer');
    expect(creds).toBeTruthy();

    await page.goto('/');
    await page.getByLabel('Email or Username').fill(creds!.email);
    await page.getByLabel('Password').fill(creds!.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('button', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add User' })).toHaveCount(0);

    await page.getByLabel('Search').fill(regNo);
    const row = page.getByRole('row', { name: new RegExp(regNo) });
    await expect(row).toBeVisible();
    await expect(row.getByText('No access')).toBeVisible();
  });

  test('analyst UI hides admin links and edit/delete actions', async ({ page }) => {
    const creds = roleCredentials.get('analyst');
    expect(creds).toBeTruthy();

    await page.goto('/');
    await page.getByLabel('Email or Username').fill(creds!.email);
    await page.getByLabel('Password').fill(creds!.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('button', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add User' })).toHaveCount(0);

    await page.getByLabel('Search').fill(regNo);
    const row = page.getByRole('row', { name: new RegExp(regNo) });
    await expect(row).toBeVisible();
    await expect(row.getByText('No access')).toBeVisible();
  });

  test('document download permissions by role (API)', async () => {
    const api = await request.newContext({ baseURL });

    const adminToken = await loginApi(api, adminEmail, adminPassword);
    const adminDownload = await api.get(`/api/patients/${patientId}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(adminDownload.status()).toBe(200);

    const dataEntry = roleCredentials.get('data_entry')!;
    const dataEntryDownload = await api.get(`/api/patients/${patientId}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${dataEntry.token}` }
    });
    expect(dataEntryDownload.status()).toBe(200);

    const reviewer = roleCredentials.get('medical_reviewer')!;
    const reviewerDownload = await api.get(`/api/patients/${patientId}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${reviewer.token}` }
    });
    expect(reviewerDownload.status()).toBe(200);

    const analyst = roleCredentials.get('analyst')!;
    const analystDownload = await api.get(`/api/patients/${patientId}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${analyst.token}` }
    });
    expect(analystDownload.status()).toBe(403);
  });
});

test.describe.skip('Role negative access (API)', () => {
  test.describe.configure({ timeout: 120_000 });
  let patientId = '';
  let documentId = '';
  let dataEntryToken = '';
  let analystToken = '';
  let reviewerToken = '';

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const api = await request.newContext({ baseURL });
    const adminToken = await loginApi(api, adminEmail, adminPassword);
    const suffix = Date.now().toString();

    const created = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        registered_no: `E2E-NEG-${suffix}`,
        patient_name: 'E2E Negative Patient',
        gender: 'Male',
        blood_group: 'B+',
        diagnosed: false
      }
    });
    expect(created.status()).toBe(201);
    patientId = (await created.json()).data.patient._id;

    const upload = await api.post(`/api/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        documentType: 'diagnosis_report',
        issuingAuthority: 'E2E',
        file: {
          name: 'neg-report.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 NEG')
        }
      }
    });
    expect(upload.status()).toBe(201);
    documentId = (await upload.json()).data.document._id;

    const dataEntry = await createRoleUser(api, adminToken, 'data_entry', suffix);
    dataEntryToken = await loginApi(api, dataEntry.email, dataEntry.password);

    const analyst = await createRoleUser(api, adminToken, 'analyst', suffix);
    analystToken = await loginApi(api, analyst.email, analyst.password);

    const reviewer = await createRoleUser(api, adminToken, 'medical_reviewer', suffix);
    reviewerToken = await loginApi(api, reviewer.email, reviewer.password);
  });

  test('data entry cannot delete patient', async () => {
    const api = await request.newContext({ baseURL });
    const response = await api.delete(`/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` }
    });
    expect(response.status()).toBe(403);
  });

  test('analyst cannot view documents', async () => {
    const api = await request.newContext({ baseURL });
    const response = await api.get(`/api/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${analystToken}` }
    });
    expect(response.status()).toBe(403);
  });

  test('data entry cannot verify or reject documents', async () => {
    const api = await request.newContext({ baseURL });
    const verify = await api.patch(`/api/patients/${patientId}/documents/${documentId}/verify`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` },
      data: { remarks: 'No access' }
    });
    expect(verify.status()).toBe(403);

    const reject = await api.patch(`/api/patients/${patientId}/documents/${documentId}/reject`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` },
      data: { remarks: 'No access' }
    });
    expect(reject.status()).toBe(403);
  });

  test('reviewer cannot delete patient', async () => {
    const api = await request.newContext({ baseURL });
    const response = await api.delete(`/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${reviewerToken}` }
    });
    expect(response.status()).toBe(403);
  });
});
