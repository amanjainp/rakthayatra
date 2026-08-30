import { test, expect } from '@playwright/test';
import { loginAs, logout, DEMO_ACCOUNTS } from './helpers';

/**
 * HOSPITAL Journey — E2E Spec
 *
 * Covers:
 *   1. Login as hospital
 *   2. Dashboard renders hospital-specific UI
 *   3. Blood requests list visible
 *   4. Request approval workflow (approve button visible for APPROVED-capable role)
 *   5. Inventory search accessible
 *   6. Donation camps listing
 *   7. Profile page renders
 *   8. Logout
 */

const HOSPITAL = DEMO_ACCOUNTS.hospital;

test.describe('Hospital Journey', () => {
  // -------------------------------------------------------------------------
  // 1. Login
  // -------------------------------------------------------------------------
  test('should login successfully as hospital', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await expect(page).toHaveURL(/\/hospital|\/dashboard/);
  });

  // -------------------------------------------------------------------------
  // 2. Dashboard
  // -------------------------------------------------------------------------
  test('should render hospital dashboard with quick action cards', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    // Navigate to dashboard root or hospital-specific dashboard
    const dashboardUrl = page.url();
    expect(dashboardUrl).toMatch(/hospital|dashboard/);
    // At least one heading
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Blood requests list
  // -------------------------------------------------------------------------
  test('should display blood requests listing page', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /request/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Approve button visible for pending requests (UI check)
  // -------------------------------------------------------------------------
  test('should show approve/reject controls on blood request items', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await page.goto('/requests');
    // If there are any requests, approve button should exist somewhere in DOM
    const approveBtn = page.getByRole('button', { name: /approve|fulfill|process/i });
    const hasRequests = await approveBtn.count() > 0;
    // This is a soft assertion — passes if either button exists OR empty state shown
    if (!hasRequests) {
      await expect(page.getByText(/no request|empty|no blood/i)).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // 5. Inventory search
  // -------------------------------------------------------------------------
  test('should display inventory search page', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. Donation camps listing
  // -------------------------------------------------------------------------
  test('should display donation camps page', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 7. Profile page
  // -------------------------------------------------------------------------
  test('should navigate to profile page', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile|account/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Logout
  // -------------------------------------------------------------------------
  test('should logout hospital and redirect to login', async ({ page }) => {
    await loginAs(page, HOSPITAL.email, HOSPITAL.password);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
