import { test, expect, request as pwRequest } from '@playwright/test';
import { apiLogin, injectAuthToken, logout, DEMO_ACCOUNTS } from './helpers';

const ADMIN = DEMO_ACCOUNTS.admin;
let adminToken: string;

test.describe('Admin Journey', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    adminToken = await apiLogin(ctx, ADMIN.email, ADMIN.password);
    await ctx.dispose();
  });

  test('should login successfully as admin (token injection)', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('should render admin dashboard with overview cards', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('should display admin overview cards and action buttons', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/admin/dashboard');
    // Admin dashboard shows 'System Administration' h1 and action cards
    await expect(page.getByRole('heading', { name: /system administration/i })).toBeVisible();
    const hasApproveCard = await page.getByText(/approve hospital/i).isVisible().catch(() => false);
    const hasRegisterCamp = await page.getByText(/register new camp/i).isVisible().catch(() => false);
    expect(hasApproveCard || hasRegisterCamp).toBe(true);
  });

  test('should display blood requests page with table or empty state', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /blood request/i })).toBeVisible();
    const hasActions = await page.getByRole('button', { name: /approve|reject|cancel/i }).count() > 0;
    const hasEmpty   = await page.getByText(/no blood request|no request records/i).isVisible().catch(() => false);
    const hasTable   = await page.locator('table').isVisible().catch(() => false);
    expect(hasActions || hasEmpty || hasTable).toBe(true);
  });

  test('should access inventory management as admin', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
  });

  test('should display donation camps management for admin', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i }).first()).toBeVisible();
    const hasCreate = await page.getByRole('button', { name: /create|launch|new camp/i }).isVisible().catch(() => false);
    const hasEmpty  = await page.getByText(/no camp|empty/i).isVisible().catch(() => false);
    const hasCard   = await page.locator('[class*="camp"], article, section').first().isVisible().catch(() => false);
    expect(hasCreate || hasEmpty || hasCard).toBe(true);
  });

  test('should show profile / account settings for admin', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile|account|settings/i })).toBeVisible();
  });

  test('should logout admin and redirect to login', async ({ page }) => {
    await injectAuthToken(page, adminToken);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
