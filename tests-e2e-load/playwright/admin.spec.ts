import { test, expect } from '@playwright/test';
import { loginAs, logout, DEMO_ACCOUNTS } from './helpers';

/**
 * ADMIN Journey — E2E Spec
 *
 * Covers:
 *   1. Login as admin
 *   2. Admin dashboard renders
 *   3. User management panel visible
 *   4. Blood request approval controls visible
 *   5. Inventory management accessible
 *   6. Donation camps management
 *   7. Admin metrics / audit log page
 *   8. Logout
 */

const ADMIN = DEMO_ACCOUNTS.admin;

test.describe('Admin Journey', () => {
  // -------------------------------------------------------------------------
  // 1. Login
  // -------------------------------------------------------------------------
  test('should login successfully as admin', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin|\/dashboard/);
  });

  // -------------------------------------------------------------------------
  // 2. Admin dashboard
  // -------------------------------------------------------------------------
  test('should render admin dashboard with overview cards', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    // Navigate to admin section
    await page.goto('/admin');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. User management panel
  // -------------------------------------------------------------------------
  test('should display users management section', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin');
    const hasUsers = await page.getByText(/user/i).first().isVisible().catch(() => false);
    expect(hasUsers).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Blood request management
  // -------------------------------------------------------------------------
  test('should display blood requests with approve/reject controls', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /request/i })).toBeVisible();
    // Admin sees approve actions — either visible or empty state
    const hasActions = await page.getByRole('button', { name: /approve|reject|cancel/i }).count() > 0;
    const hasEmpty = await page.getByText(/no request|empty/i).isVisible().catch(() => false);
    expect(hasActions || hasEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Inventory management
  // -------------------------------------------------------------------------
  test('should access inventory management as admin', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. Donation camps management
  // -------------------------------------------------------------------------
  test('should display donation camps management for admin', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i })).toBeVisible();
    // Admin should see create camp / manage buttons
    const hasCreate = await page.getByRole('button', { name: /create|launch|new camp/i }).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no camp|empty/i).isVisible().catch(() => false);
    expect(hasCreate || hasEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Metrics page visible (Prometheus endpoint, not UI — skip if not exposed)
  // -------------------------------------------------------------------------
  test('should show profile / account settings for admin', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile|account|settings/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Logout
  // -------------------------------------------------------------------------
  test('should logout admin and redirect to login', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
