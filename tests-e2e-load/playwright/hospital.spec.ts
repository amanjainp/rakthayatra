import { test, expect, request as pwRequest } from '@playwright/test';
import { apiLogin, injectAuthToken, logout, DEMO_ACCOUNTS } from './helpers';

const HOSPITAL = DEMO_ACCOUNTS.hospital;
let hospitalToken: string;

test.describe('Hospital Journey', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    hospitalToken = await apiLogin(ctx, HOSPITAL.email, HOSPITAL.password);
    await ctx.dispose();
  });

  test('should login successfully as hospital (token injection)', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/hospital/dashboard');
    await expect(page).toHaveURL(/\/hospital/);
  });

  test('should render hospital dashboard with quick action cards', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/hospital/dashboard');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('should display blood requests listing page', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /request/i })).toBeVisible();
  });

  test('should show approve/reject controls or empty state on requests', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /blood request/i })).toBeVisible();
    const hasActions = await page.getByRole('button', { name: /approve|fulfill|process/i }).count() > 0;
    const hasEmpty   = await page.getByText(/no blood request|no request records|matches the selected/i).isVisible().catch(() => false);
    const hasTable   = await page.locator('table').isVisible().catch(() => false);
    expect(hasActions || hasEmpty || hasTable).toBe(true);
  });

  test('should display inventory search page', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: /blood inventory|inventory/i }).first()).toBeVisible();
  });

  test('should display donation camps page', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i }).first()).toBeVisible();
  });

  test('should navigate to profile page', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile|account/i })).toBeVisible();
  });

  test('should logout hospital and redirect to login', async ({ page }) => {
    await injectAuthToken(page, hospitalToken);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
