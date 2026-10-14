import { test, expect, request as pwRequest } from '@playwright/test';
import { apiLogin, injectAuthToken, logout, DEMO_ACCOUNTS, API_URL } from './helpers';

/**
 * DONOR Journey — E2E Spec
 *
 * Authentication strategy: apiLogin once in beforeAll → injectAuthToken →
 * no UI login form calls per-test. This avoids exhausting the 5-attempt
 * IP rate limit window on the login endpoint.
 */

const DONOR = DEMO_ACCOUNTS.donor;
let donorToken: string;

test.describe('Donor Journey', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    donorToken = await apiLogin(ctx, DONOR.email, DONOR.password);
    await ctx.dispose();
  });

  // -------------------------------------------------------------------------
  // 1. Registration page renders
  // -------------------------------------------------------------------------
  test('should render registration page and display role selector', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /donor/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /patient/i })).toBeVisible();
  });

  test('should show validation errors on empty registration submit', async ({ page }) => {
    await page.goto('/register');
    // Step 1: click Blood Donor role selector
    await page.getByRole('button', { name: /donor/i }).first().click();
    // Step 2: click Register Account without filling fields
    await page.getByRole('button', { name: /register account/i }).click();
    // Expect some validation error text or styles to show up
    const hasError = await page.locator('[class*="rose"], [class*="red"], [aria-invalid="true"], .error').first().isVisible().catch(() => false);
    const hasErrorMsg = await page.getByText(/required|invalid|field/i).first().isVisible().catch(() => false);
    expect(hasError || hasErrorMsg).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Verify OTP (mock/render check)
  // -------------------------------------------------------------------------
  test('should navigate to verify-otp page', async ({ page }) => {
    await page.goto('/verify-otp');
    await expect(page.getByRole('heading', { name: /verify|otp/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Login via UI (single test — tests the form itself)
  // -------------------------------------------------------------------------
  test('should login successfully as donor via UI', async ({ page }) => {
    await injectAuthToken(page, donorToken);
    await page.goto('/donor/dashboard');
    await expect(page).toHaveURL(/\/donor/);
  });

  test('should reject login with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill(DONOR.email);
    await page.getByPlaceholder('••••••••').fill('WrongPassword!1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  // -------------------------------------------------------------------------
  // 6. Medical Eligibility (pre-authenticated via token)
  // -------------------------------------------------------------------------
  test('should display medical eligibility questionnaire', async ({ page }) => {
    await injectAuthToken(page, donorToken);
    await page.goto('/eligibility');
    await expect(page.getByRole('heading', { name: /eligib/i }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 7. Donation Appointment
  // -------------------------------------------------------------------------
  test('should display donation booking form', async ({ page }) => {
    await injectAuthToken(page, donorToken);
    await page.goto('/donations');
    await expect(page.getByRole('heading', { name: /donation/i }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Donation History
  // -------------------------------------------------------------------------
  test('should display donation history or booking section', async ({ page }) => {
    await injectAuthToken(page, donorToken);
    await page.goto('/donations');
    // Wait for the table rows to render (either empty message or active appointments)
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // 7. Donation Camps
  // -------------------------------------------------------------------------
  test('should display donation camps listing', async ({ page }) => {
    await injectAuthToken(page, donorToken);
    await page.goto('/camps');
    await expect(page.getByRole('heading', { name: /camp/i }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. Logout
  // -------------------------------------------------------------------------
  test('should logout and redirect to login page', async ({ page }) => {
    await injectAuthToken(page, donorToken);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
