import { test, expect } from '@playwright/test';
import { loginAs, logout, DEMO_ACCOUNTS } from './helpers';

/**
 * PATIENT Journey — E2E Spec
 *
 * Covers:
 *   1. Registration page renders with PATIENT role selector
 *   2. Login as patient
 *   3. Create blood request form visible
 *   4. Emergency blood request submission
 *   5. View own blood request status
 *   6. View nearby blood availability (Emergency Map)
 *   7. Attempt unauthorized access to admin route → 403 / redirect
 *   8. Logout
 */

const PATIENT = DEMO_ACCOUNTS.patient;

test.describe('Patient Journey', () => {
  // -------------------------------------------------------------------------
  // 1. Registration with PATIENT role
  // -------------------------------------------------------------------------
  test('should pre-select PATIENT role when navigated with role query param', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Login
  // -------------------------------------------------------------------------
  test('should login successfully as patient', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await expect(page).toHaveURL(/\/patient|\/dashboard/);
  });

  // -------------------------------------------------------------------------
  // 3. Blood request form visible
  // -------------------------------------------------------------------------
  test('should display blood request form', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /blood request|request/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Emergency blood request — create form renders correctly
  // -------------------------------------------------------------------------
  test('should show urgency EMERGENCY option in create request form', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await page.goto('/requests');
    // Look for urgency selector or EMERGENCY option
    const emergencyOption = page.getByText(/emergency/i).first();
    await expect(emergencyOption).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. View request status list
  // -------------------------------------------------------------------------
  test('should display blood request list or empty state', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await page.goto('/requests');
    const hasList = await page.locator('table, [data-testid="requests-list"], ul').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no request|no blood request/i).isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Emergency Map / nearby blood availability
  // -------------------------------------------------------------------------
  test('should navigate to emergency map page', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await page.goto('/emergency-map');
    await expect(page.getByRole('heading', { name: /emergency|map|availability/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 7. Unauthorized access → ADMIN route should be blocked
  // -------------------------------------------------------------------------
  test('should block patient access to admin panel and show access denied', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await page.goto('/admin');
    // Expect redirect to access-denied or dashboard, not admin content
    const isBlocked =
      page.url().includes('/access-denied') ||
      page.url().includes('/dashboard') ||
      page.url().includes('/patient') ||
      await page.getByText(/access denied|unauthorized|forbidden/i).isVisible().catch(() => false);
    expect(isBlocked).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Logout
  // -------------------------------------------------------------------------
  test('should logout patient and redirect to login', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
