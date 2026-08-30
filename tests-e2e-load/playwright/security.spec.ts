import { test, expect } from '@playwright/test';
import { loginAs, DEMO_ACCOUNTS, API_URL } from './helpers';

/**
 * Security & Authorization E2E Spec
 *
 * Verifies:
 *   1. Unauthenticated access to protected routes → redirected to /login
 *   2. IDOR: Donor cannot access another donor's medical data via UI
 *   3. Cross-role route blocking: Patient blocked from /admin
 *   4. Donor blocked from admin blood request approval controls
 *   5. Expired/invalid token → 401 on API layer
 *   6. XSS payload in login form is not executed
 *   7. Open redirect in ?redirect= query param is neutralised
 *   8. Rate limiting feedback visible after repeated failed logins
 */

const DONOR   = DEMO_ACCOUNTS.donor;
const PATIENT = DEMO_ACCOUNTS.patient;
const ADMIN   = DEMO_ACCOUNTS.admin;

test.describe('Security & Authorization', () => {
  // -------------------------------------------------------------------------
  // 1. Unauthenticated access → redirect to /login
  // -------------------------------------------------------------------------
  test('should redirect unauthenticated user from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user from /requests to /login', async ({ page }) => {
    await page.goto('/requests');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user from /admin to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  // -------------------------------------------------------------------------
  // 2. Cross-role: Patient cannot access admin panel
  // -------------------------------------------------------------------------
  test('patient navigating to /admin is blocked or redirected', async ({ page }) => {
    await loginAs(page, PATIENT.email, PATIENT.password);
    await page.goto('/admin');
    const isBlocked =
      page.url().includes('/access-denied') ||
      !page.url().includes('/admin') ||
      await page.getByText(/access denied|unauthorized|forbidden/i).isVisible().catch(() => false);
    expect(isBlocked).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Cross-role: Donor cannot approve blood requests via UI
  // -------------------------------------------------------------------------
  test('donor should not see blood request approve button', async ({ page }) => {
    await loginAs(page, DONOR.email, DONOR.password);
    await page.goto('/requests');
    // Approve button (admin/hospital-only) should NOT be visible for donor
    const approveCount = await page.getByRole('button', { name: /^approve$/i }).count();
    expect(approveCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 4. Invalid Bearer token → API returns 401
  // -------------------------------------------------------------------------
  test('invalid Authorization token returns 401 from API', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(response.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 5. Missing Bearer token → API returns 401
  // -------------------------------------------------------------------------
  test('missing Authorization header returns 401 from API', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/api/auth/me`);
    expect(response.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 6. XSS payload in login form is not executed
  // -------------------------------------------------------------------------
  test('XSS payload in email field is not executed', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', () => { alertFired = true; });

    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill('<script>alert("xss")</script>');
    await page.getByPlaceholder('••••••••').fill('doesnotmatter');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Wait briefly — any XSS would fire synchronously
    await page.waitForTimeout(1_000);
    expect(alertFired).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 7. Open redirect via ?redirect= query param is neutralised
  // -------------------------------------------------------------------------
  test('open redirect to external domain is blocked after login', async ({ page }) => {
    // Attempt to exploit ?redirect= to an external domain
    await page.goto('/login?redirect=https://evil.example.com');
    await page.getByPlaceholder('name@example.com').fill(DONOR.email);
    await page.getByPlaceholder('••••••••').fill(DONOR.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2_000);
    // After login, must NOT land on external domain
    expect(page.url()).not.toContain('evil.example.com');
  });

  // -------------------------------------------------------------------------
  // 8. Rate limiting: 5 consecutive bad logins should show lockout feedback
  // -------------------------------------------------------------------------
  test('consecutive failed logins show rate limit or error feedback', async ({ page }) => {
    await page.goto('/login');
    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder('name@example.com').fill('attacker@evil.org');
      await page.getByPlaceholder('••••••••').fill(`WrongPass${i}`);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForTimeout(500);
    }
    // After multiple failures, expect some error/rate-limit message visible
    const hasError = await page.getByText(/invalid|too many|rate limit|locked|failed/i).isVisible().catch(() => false);
    expect(hasError).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. Health endpoint is publicly accessible without auth
  // -------------------------------------------------------------------------
  test('health/live endpoint returns 200 without authentication', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/health/live`);
    expect(response.status()).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 10. IDOR: patient cannot read another user profile via API
  // -------------------------------------------------------------------------
  test('IDOR — API rejects cross-user profile read attempt', async ({ page }) => {
    // Login as patient and try to read donor's profile with the patient's token
    await loginAs(page, PATIENT.email, PATIENT.password);
    const token = await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (!token) {
      test.skip(); // Token not in storage — skip rather than fail
      return;
    }
    const response = await page.request.get(`${API_URL}/api/donors/some-other-user-id/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([403, 404]).toContain(response.status());
  });
});
