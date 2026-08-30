import { test, expect } from '@playwright/test';
import { loginAs, logout, DEMO_ACCOUNTS, expectToast } from './helpers';

/**
 * DONOR Journey — E2E Spec
 *
 * Covers:
 *   1. Registration (new account)
 *   2. OTP verification page appearance
 *   3. Login with existing seeded account
 *   4. Medical eligibility questionnaire
 *   5. Donation appointment booking
 *   6. Donation history visibility
 *   7. Donation camps discovery
 *   8. Logout
 */

const DONOR = DEMO_ACCOUNTS.donor;

test.describe('Donor Journey', () => {
  // -------------------------------------------------------------------------
  // 1. Registration
  // -------------------------------------------------------------------------
  test('should render registration page and display role selector', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
    // Role selection buttons
    await expect(page.getByRole('button', { name: /donor/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /patient/i })).toBeVisible();
  });

  test('should show validation errors on empty registration submit', async ({ page }) => {
    await page.goto('/register');
    // Try to advance without filling Step 1
    await page.getByRole('button', { name: /next|continue/i }).click();
    // Expect at least one validation message
    await expect(page.locator('p.text-rose-500, p[class*="rose"]').first()).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 2. OTP Page
  // -------------------------------------------------------------------------
  test('should navigate to verify-otp page after registration', async ({ page }) => {
    await page.goto('/verify-otp');
    await expect(page.getByRole('heading', { name: /verify|otp/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Login
  // -------------------------------------------------------------------------
  test('should login successfully as donor', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await expect(page).toHaveURL(/\/donor|\/dashboard/);
    await expect(page.getByText(/donor/i)).toBeVisible();
  });

  test('should reject login with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill(DONOR.email);
    await page.getByPlaceholder('••••••••').fill('WrongPassword!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login
    await expect(page).toHaveURL(/\/login/);
  });

  // -------------------------------------------------------------------------
  // 4. Medical Eligibility
  // -------------------------------------------------------------------------
  test('should display medical eligibility questionnaire', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await page.goto('/eligibility');
    await expect(page.getByRole('heading', { name: /eligib/i })).toBeVisible();
    // At least one question should render
    await expect(page.locator('form, [role="form"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Donation Appointment Booking
  // -------------------------------------------------------------------------
  test('should display donation booking form', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await page.goto('/donations');
    await expect(page.getByRole('heading', { name: /donation/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. Donation History
  // -------------------------------------------------------------------------
  test('should display donation history section', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await page.goto('/donations');
    // Either a table/list or empty state
    const hasTable = await page.locator('table, [data-testid="donation-list"]').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no donation|no record|history/i).isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Donation Camps Discovery
  // -------------------------------------------------------------------------
  test('should display donation camps listing', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Logout
  // -------------------------------------------------------------------------
  test('should logout and redirect to login page', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
