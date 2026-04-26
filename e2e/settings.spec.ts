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

test.skip('super admin can view and update settings', async ({ page }) => {
  test.setTimeout(60_000);

  await login(page, adminEmail, adminPassword);
  await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

  // Navigate to settings
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: /system settings/i })).toBeVisible();

  // Check initial settings are loaded
  await expect(page.getByLabel('Week Start Day')).toBeVisible();
  await expect(page.getByLabel('Week Time Zone')).toBeVisible();
  await expect(page.getByText('Allow Back-Entry for Friday Calls')).toBeVisible();

  // Modify settings
  await page.getByLabel('Week Start Day').selectOption('Monday');
  await page.getByLabel('Week Time Zone').fill('America/New_York');
  await page.getByLabel('Back-Entry Warning Days').fill('14');

  // Add a new hospital to the hospitals textarea
  await page.getByLabel('Hospitals (one per line)').waitFor({ timeout: 5000 });
  await page.getByLabel('Hospitals (one per line)').fill('Test Hospital E2E');

  // Add a new blood group to the blood groups textarea
  await page.getByLabel('Blood Groups (one per line)').fill('O-');

  // Add a new email recipient
  await page.getByRole('button', { name: /add recipient/i }).click();
  const recipientNameInputs = page.getByPlaceholder('Name');
  const lastRecipientNameInput = recipientNameInputs.last();
  await lastRecipientNameInput.fill('E2E Test Recipient');

  const recipientEmailInputs = page.getByPlaceholder('Email');
  const lastRecipientEmailInput = recipientEmailInputs.last();
  await lastRecipientEmailInput.fill('e2e-test@example.com');

  // Save settings
  await page.getByRole('button', { name: /save settings/i }).click();

  // Check for success message
  await expect(page.getByText('Settings saved successfully')).toBeVisible();

  // Refresh page to verify persistence
  await page.reload();

  // Navigate back to settings after reload
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: /system settings/i })).toBeVisible();

  // Verify settings were persisted
  await expect(page.getByLabel('Week Start Day')).toHaveValue('Monday');
  await expect(page.getByLabel('Week Time Zone')).toHaveValue('America/New_York');
  await expect(page.getByLabel('Back-Entry Warning Days')).toHaveValue('14');

  // Verify hospital was added to textarea
  await expect(page.getByLabel('Hospitals (one per line)')).toHaveValue('Test Hospital E2E');

  // Verify blood group was added to textarea
  await expect(page.getByLabel('Blood Groups (one per line)')).toHaveValue('O-');

  // Verify email recipient was added (check the last recipient name input)
  const recipientNameInputsAfterReload = page.getByPlaceholder('Name');
  const lastRecipientNameInputAfterReload = recipientNameInputsAfterReload.last();
  await expect(lastRecipientNameInputAfterReload).toHaveValue('E2E Test Recipient');

  await logout(page);
});

test.skip('non-admin users cannot access settings', async ({ page }) => {
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
  const userEmail = `data-entry-${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;

  const createUserResponse = await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: userEmail,
      name: 'Data Entry User',
      role: 'data_entry',
      tempPassword
    }
  });
  expect(createUserResponse.status()).toBe(201);

  // Login as data entry user
  await login(page, userEmail, tempPassword);

  // Change password first
  await page.getByLabel('Current Password').fill(tempPassword);
  await page.getByLabel('New Password', { exact: true }).fill('NewPass123!');
  await page.getByLabel('Confirm New Password').fill('NewPass123!');
  await page.getByRole('button', { name: /update password/i }).click();

  // Navigate to patients list (should be default view)
  await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();

  // Check that settings button is not visible or disabled
  const settingsButton = page.getByRole('button', { name: /settings/i });
  await expect(settingsButton).not.toBeVisible();

  await logout(page);
});
