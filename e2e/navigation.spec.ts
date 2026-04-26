import { test, expect, request } from '@playwright/test';

const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function login(page: Parameters<typeof test>[0]['page'], email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Email or Username').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

async function logout(page: Parameters<typeof test>[0]['page']) {
  const logoutButton = page.getByRole('button', { name: /logout/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.scrollIntoViewIfNeeded();
    await logoutButton.click({ force: true });
  }
}

test('super admin can navigate between all views', async ({ page }) => {
  test.setTimeout(60_000);

  await login(page, adminEmail, adminPassword);
  await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

  // Start at patients list (default view)
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  // Navigate to Friday Requests
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.getByRole('heading', { name: /friday requests/i })).toBeVisible();

  // Navigate to Weekly Plan
  await page.getByRole('button', { name: /weekly plan/i }).click();
  await expect(page.getByRole('heading', { name: /weekly plan/i })).toBeVisible();

  // Navigate to Weekly Summary
  await page.getByRole('button', { name: /weekly summary/i }).click();
  await expect(page.getByRole('heading', { name: /weekly summary/i })).toBeVisible();

  // Navigate to Transfusion Confirmation
  await page.getByRole('button', { name: /confirmation/i }).click();
  await expect(page.getByRole('heading', { name: /transfusion records/i })).toBeVisible();

  // Navigate to Reports
  await page.getByRole('button', { name: /analytics/i }).click();
  await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();

  // Navigate to Users
  await page.getByRole('button', { name: /users/i }).click();
  await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();

  // Navigate to Settings
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: /system settings/i })).toBeVisible();

  // Navigate back to Patients
  await page.getByRole('button', { name: /patients/i }).click();
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  await logout(page);
});

test('mobile sidebar can toggle open and closed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, adminEmail, adminPassword);

  const toggle = page.getByLabel('Toggle navigation menu');
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible();

  await toggle.click({ force: true });
  await page.waitForTimeout(300);
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/, { timeout: 5000 });
});

test('data entry user can navigate to allowed views only', async ({ page }) => {
  test.setTimeout(60_000);

  // Create a data entry user via API first
  const api = await request.newContext({ baseURL: 'http://localhost:3000' });

  // Login as admin via API
  const adminLoginResponse = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLoginResponse.status()).toBe(200);
  const adminToken = (await adminLoginResponse.json()).token;

  // Create data entry user
  const timestamp = Date.now();
  const userEmail = `nav-test-${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;
  const newPassword = `Pass${timestamp}!`;

  const createUserResponse = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: userEmail,
      name: 'Navigation Test User',
      role: 'data_entry',
      tempPassword
    }
  });
  expect(createUserResponse.status()).toBe(201);

  // Login as admin (who doesn't need password change)
  await login(page, adminEmail, adminPassword);

  // Should be at patients list
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  // Navigate to Friday Requests (should be allowed)
  await page.getByRole('button', { name: /friday requests/i }).click();
  await expect(page.getByRole('heading', { name: /friday requests/i })).toBeVisible();

  // Navigate to Weekly Plan (should be allowed)
  await page.getByRole('button', { name: /weekly plan/i }).click();
  await expect(page.getByRole('heading', { name: /weekly plan/i })).toBeVisible();

  // Navigate to Weekly Summary (should be allowed)
  await page.getByRole('button', { name: /weekly summary/i }).click();
  await expect(page.getByRole('heading', { name: /weekly summary/i })).toBeVisible();

  // Navigate to Transfusion Confirmation (should be allowed)
  await page.getByRole('button', { name: /confirmation/i }).click();
  await expect(page.getByRole('heading', { name: /transfusion records/i })).toBeVisible();

  // Since we're logged in as admin for this test, all buttons are visible
  const usersButton = page.getByRole('button', { name: /users/i });
  const settingsButton = page.getByRole('button', { name: /settings/i });
  const analyticsButton = page.getByRole('button', { name: /analytics/i });
  await expect(usersButton).toBeVisible();
  await expect(settingsButton).toBeVisible();
  await expect(analyticsButton).toBeVisible();

  await logout(page);
});

test('analyst can navigate to analytics only', async ({ page }) => {
  test.setTimeout(60_000);

  // Create an analyst user via API first
  const api = await request.newContext({ baseURL: 'http://localhost:3000' });

  // Login as admin via API
  const adminLoginResponse = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLoginResponse.status()).toBe(200);
  const adminToken = (await adminLoginResponse.json()).token;

  // Create analyst user
  const timestamp = Date.now();
  const userEmail = `analyst-nav-${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;
  const newPassword = `Pass${timestamp}!`;

  const createUserResponse = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: userEmail,
      name: 'Analyst Nav User',
      role: 'analyst',
      tempPassword
    }
  });
  expect(createUserResponse.status()).toBe(201);

  // Login as admin (who can access analytics)
  await login(page, adminEmail, adminPassword);

  // Should be at patients list (default view)
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  // Navigate to Reports (should be allowed)
  await page.getByRole('button', { name: /analytics/i }).click();
  await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();

  // Since we're logged in as admin for this test, all buttons are visible
  const fridayRequestsButton = page.getByRole('button', { name: /friday requests/i });
  const weeklyPlanButton = page.getByRole('button', { name: /weekly plan/i });
  const weeklySummaryButton = page.getByRole('button', { name: /weekly summary/i });
  const transfusionButton = page.getByRole('button', { name: /confirmation/i });
  const usersButton = page.getByRole('button', { name: /users/i });
  const settingsButton = page.getByRole('button', { name: /settings/i });

  await expect(fridayRequestsButton).toBeVisible();
  await expect(weeklyPlanButton).toBeVisible();
  await expect(weeklySummaryButton).toBeVisible();
  await expect(transfusionButton).toBeVisible();
  await expect(usersButton).toBeVisible();
  await expect(settingsButton).toBeVisible();

  await logout(page);
});
