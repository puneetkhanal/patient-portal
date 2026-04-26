import { test, expect } from '@playwright/test';

const adminEmail = 'admin@example.com';
const adminPassword = '123456';

const roles = [
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'medical_reviewer', label: 'Medical Reviewer' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'super_admin', label: 'Super Admin' }
];

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

test('super admin can create users for all roles and users must change temp password', async ({ page }) => {
  test.setTimeout(90_000);

  await login(page, adminEmail, adminPassword);
  await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

  const createdUsers: Array<{ email: string; tempPassword: string; newPassword: string }> = [];

  for (const role of roles) {
    const timestamp = Date.now();
    const email = `e2e_${role.value}_${timestamp}@example.com`;
    const tempPassword = `Temp${timestamp}`;
    const newPassword = `New${timestamp}!`;

    await page.getByRole('button', { name: /users/i }).click();
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: /add user/i }).click();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Name').fill(`E2E ${role.label}`);
    await page.getByLabel('Role').selectOption(role.value);
    await page.getByLabel('One-time Password').fill(tempPassword);
    await page.getByRole('button', { name: /create user/i }).click();

    await expect(page.getByText(`User created: ${email}`)).toBeVisible();
    await page.getByRole('button', { name: /back to patients/i }).click();

    createdUsers.push({ email, tempPassword, newPassword });
  }

  for (const user of createdUsers) {
    await logout(page);
    await login(page, user.email, user.tempPassword);

    await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
    await page.getByLabel('Current Password').fill(user.tempPassword);
    await page.getByLabel('New Password', { exact: true }).fill(user.newPassword);
    await page.getByLabel('Confirm New Password').fill(user.newPassword);
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
  }
});

test('super admin can deactivate a user and login is blocked', async ({ page }) => {
  test.setTimeout(60_000);

  await login(page, adminEmail, adminPassword);
  await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

  const timestamp = Date.now();
  const email = `e2e_deactivate_${timestamp}@example.com`;
  const tempPassword = `Temp${timestamp}`;
  const newPassword = `New${timestamp}!`;

  await page.getByRole('button', { name: /users/i }).click();
  await page.getByRole('main').getByRole('button', { name: /add user/i }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Name').fill('E2E Deactivate');
  await page.getByLabel('Role').selectOption('data_entry');
  await page.getByLabel('One-time Password').fill(tempPassword);
  await page.getByRole('button', { name: /create user/i }).click();
  await expect(page.getByText(`User created: ${email}`)).toBeVisible();

  await page.getByRole('button', { name: /users/i }).click();
  const row = page.getByText(email).locator('..');
  await row.getByRole('button', { name: /deactivate/i }).click();
  await expect(row.getByText('Inactive')).toBeVisible();

  await logout(page);
  await login(page, email, tempPassword);
  await expect(page.locator('.error-message')).toContainText(/deactivated/i);
});
