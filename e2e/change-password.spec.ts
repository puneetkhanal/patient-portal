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
    await logoutButton.click();
  }
}

test('user can change their password', async ({ page }) => {
  test.setTimeout(60_000);

  // Create a test user via API first
  const api = await request.newContext({ baseURL: 'http://localhost:3000' });

  // Login as admin via API
  const adminLoginResponse = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLoginResponse.status()).toBe(200);
  const adminToken = (await adminLoginResponse.json()).token;

  // Create data entry user
  const timestamp = Date.now();
  const userEmail = `changepass-${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;
  const newPassword = `NewPass${timestamp}!`;

  const createUserResponse = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: userEmail,
      name: 'Change Password User',
      role: 'data_entry',
      tempPassword
    }
  });
  expect(createUserResponse.status()).toBe(201);

  // Login as the new user
  await login(page, userEmail, tempPassword);

  // Should be redirected to change password
  await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
  await expect(page.getByText(/Please set a new password to continue/i)).toBeVisible();

  // Change password
  await page.getByLabel('Current Password').fill(tempPassword);
  await page.getByLabel('New Password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm New Password').fill(newPassword);
  await page.getByRole('button', { name: /update password/i }).click();

  // Should be redirected to main app
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  // Logout and login with new password
  await logout(page);
  await login(page, userEmail, newPassword);

  // Should be logged in successfully
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  await logout(page);
});

test('password change fails with incorrect current password', async ({ page }) => {
  test.setTimeout(60_000);

  // Create a test user via API first
  const api = await request.newContext({ baseURL: 'http://localhost:3000' });

  // Login as admin via API
  const adminLoginResponse = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLoginResponse.status()).toBe(200);
  const adminToken = (await adminLoginResponse.json()).token;

  // Create data entry user
  const timestamp = Date.now();
  const userEmail = `changepass-fail-${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;

  const createUserResponse = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: userEmail,
      name: 'Change Password Fail User',
      role: 'data_entry',
      tempPassword
    }
  });
  expect(createUserResponse.status()).toBe(201);

  // Login as the new user
  await login(page, userEmail, tempPassword);

  // Try to change password with wrong current password
  await page.getByLabel('Current Password').fill('WrongPassword');
  await page.getByLabel('New Password', { exact: true }).fill('NewPass123!');
  await page.getByLabel('Confirm New Password').fill('NewPass123!');
  await page.getByRole('button', { name: /update password/i }).click();

  // Should still be on change password page (form should not submit with wrong password)
  await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
});

test('password change validates minimum length', async ({ page }) => {
  test.setTimeout(60_000);

  // Create a test user via API first
  const api = await request.newContext({ baseURL: 'http://localhost:3000' });

  // Login as admin via API
  const adminLoginResponse = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLoginResponse.status()).toBe(200);
  const adminToken = (await adminLoginResponse.json()).token;

  // Create data entry user
  const timestamp = Date.now();
  const userEmail = `changepass-short-${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;

  const createUserResponse = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: userEmail,
      name: 'Change Password Short User',
      role: 'data_entry',
      tempPassword
    }
  });
  expect(createUserResponse.status()).toBe(201);

  // Login as the new user
  await login(page, userEmail, tempPassword);

  // Try to change password with too short new password
  await page.getByLabel('Current Password').fill(tempPassword);
  await page.getByLabel('New Password', { exact: true }).fill('123');
  await page.getByLabel('Confirm New Password').fill('123');
  await page.getByRole('button', { name: /update password/i }).click();

  // Should still be on change password page (form should not submit with invalid data)
  await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
});