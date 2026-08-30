import { test, expect } from '@playwright/test';
import { loginAs, logout, DEMO_ACCOUNTS } from './helpers';

/**
 * BLOOD BANK Journey — E2E Spec
 *
 * Covers:
 *   1. Login as blood bank
 *   2. Dashboard renders blood-bank-specific UI
 *   3. Register blood stock form visible
 *   4. Inventory listing visible
 *   5. Expired batch sweep trigger
 *   6. Donation camps listing
 *   7. Request fulfillment visible
 *   8. Logout
 */

const BLOOD_BANK = DEMO_ACCOUNTS.bloodbank;

test.describe('Blood Bank Journey', () => {
  // -------------------------------------------------------------------------
  // 1. Login
  // -------------------------------------------------------------------------
  test('should login successfully as blood bank', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await expect(page).toHaveURL(/\/blood-bank|\/bloodbank|\/dashboard/);
  });

  // -------------------------------------------------------------------------
  // 2. Dashboard
  // -------------------------------------------------------------------------
  test('should render blood bank portal dashboard', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await expect(page.getByText(/blood bank portal/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Register blood stock form
  // -------------------------------------------------------------------------
  test('should display blood stock registration form', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
    // Register button or form
    const hasRegisterBtn = await page.getByRole('button', { name: /register|add stock|new batch/i }).count() > 0;
    const hasForm = await page.locator('form').count() > 0;
    expect(hasRegisterBtn || hasForm).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Inventory listing
  // -------------------------------------------------------------------------
  test('should display inventory list or empty state', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await page.goto('/inventory');
    const hasList = await page.locator('table, [data-testid="inventory-list"], ul').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no inventory|no batch|no stock/i).isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Expired batch sweep (UI trigger)
  // -------------------------------------------------------------------------
  test('should display sweep/scan expired batches action', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await page.goto('/inventory');
    const sweepBtn = page.getByRole('button', { name: /sweep|scan expired|expire/i });
    // Either visible directly or via quick-action cards on dashboard
    const hasSweep = await sweepBtn.isVisible().catch(() => false);
    if (!hasSweep) {
      // It may be on the dashboard quick-action cards
      await page.goto('/dashboard');
      await expect(page.getByText(/scan expired/i)).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // 6. Donation camps
  // -------------------------------------------------------------------------
  test('should display donation camps listing', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 7. Request fulfillment
  // -------------------------------------------------------------------------
  test('should display blood requests fulfillment page', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /request/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Logout
  // -------------------------------------------------------------------------
  test('should logout blood bank and redirect to login', async ({ page }) => {
    await loginAs(page, BLOOD_BANK.email, BLOOD_BANK.password);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
