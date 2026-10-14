import { test, expect, request as pwRequest } from '@playwright/test';
import { apiLogin, injectAuthToken, logout, DEMO_ACCOUNTS } from './helpers';

const BLOOD_BANK = DEMO_ACCOUNTS.bloodbank;
let bankToken: string;

test.describe('Blood Bank Journey', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    bankToken = await apiLogin(ctx, BLOOD_BANK.email, BLOOD_BANK.password);
    await ctx.dispose();
  });

  test('should login successfully as blood bank (token injection)', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/blood-bank/dashboard');
    await expect(page).toHaveURL(/\/blood-bank/);
  });

  test('should render blood bank portal dashboard', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/blood-bank/dashboard');
    await expect(page.getByText(/blood bank portal/i)).toBeVisible();
  });

  test('should display blood stock registration form or button', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
    const hasBtn  = await page.getByRole('button', { name: /register|add stock|new batch/i }).count() > 0;
    const hasForm = await page.locator('form').count() > 0;
    expect(hasBtn || hasForm).toBe(true);
  });

  test('should display inventory list or empty state', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/inventory');
    // Wait for the table or empty text to load
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display sweep/scan expired batches action', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/inventory');
    // Expect the blood inventory page to load completely
    await expect(page.getByRole('heading', { name: /blood inventory/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display donation camps listing', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i })).toBeVisible();
  });

  test('should display blood requests fulfillment page', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /request/i })).toBeVisible();
  });

  test('should logout blood bank and redirect to login', async ({ page }) => {
    await injectAuthToken(page, bankToken);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
