import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function loginApi(api: ReturnType<typeof request.newContext>, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.token as string;
}

async function waitForServer(api: ReturnType<typeof request.newContext>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const res = await api.get('/api/health');
      if (res.ok()) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Server not ready for /api/health');
}

async function createRoleUser(
  api: ReturnType<typeof request.newContext>,
  adminToken: string,
  role: 'data_entry' | 'medical_reviewer' | 'analyst',
  suffix: string
) {
  const email = `e2e-report-${role}-${suffix}@example.test`;
  const tempPassword = `Temp-${suffix}`;
  const newPassword = `Pass-${suffix}`;

  const created = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email,
      name: `E2E Report ${role}`,
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

  const token = await loginApi(api, email, newPassword);
  return token;
}

test('reports/statistics access by role (API)', async () => {
  const api = await request.newContext({ baseURL });
  await waitForServer(api);
  const adminToken = await loginApi(api, adminEmail, adminPassword);
  const suffix = Date.now().toString();

  const dataEntryToken = await createRoleUser(api, adminToken, 'data_entry', suffix);
  const reviewerToken = await createRoleUser(api, adminToken, 'medical_reviewer', suffix);
  const analystToken = await createRoleUser(api, adminToken, 'analyst', suffix);

  const adminStats = await api.get('/api/patients/statistics/overview', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(adminStats.status()).toBe(200);

  const reviewerStats = await api.get('/api/patients/statistics/overview', {
    headers: { Authorization: `Bearer ${reviewerToken}` }
  });
  expect(reviewerStats.status()).toBe(200);

  const analystStats = await api.get('/api/patients/statistics/overview', {
    headers: { Authorization: `Bearer ${analystToken}` }
  });
  expect(analystStats.status()).toBe(200);

  const dataEntryStats = await api.get('/api/patients/statistics/overview', {
    headers: { Authorization: `Bearer ${dataEntryToken}` }
  });
  expect(dataEntryStats.status()).toBe(403);
});
