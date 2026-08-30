import { Page, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Environment constants
// ---------------------------------------------------------------------------
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
export const API_URL  = process.env.API_URL  ?? 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Seeded demo accounts (populated by backend seed script)
// ---------------------------------------------------------------------------
export const DEMO_ACCOUNTS = {
  admin:     { email: 'admin@lifelink.org',     password: 'Admin@123456',   role: 'ADMIN' },
  donor:     { email: 'donor@lifelink.org',     password: 'Donor@123456',   role: 'DONOR' },
  patient:   { email: 'patient@lifelink.org',   password: 'Patient@123456', role: 'PATIENT' },
  hospital:  { email: 'hospital@lifelink.org',  password: 'Hosp@123456',    role: 'HOSPITAL' },
  bloodbank: { email: 'bloodbank@lifelink.org', password: 'Bank@123456',    role: 'BLOOD_BANK' },
} as const;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Fill the login form and submit. Expects the page to redirect away from /login.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for navigation away from /login
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
}

/**
 * Logout by navigating to /logout or clearing tokens.
 * Falls back to localStorage clear + reload if no logout route exists.
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
}

/**
 * Assert that a toast notification containing `text` appears.
 */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator('[data-hot-toast], .go2072408551, [role="status"]').first()).toContainText(text, {
    timeout: 8_000,
  });
}

/**
 * Wait for the API to be reachable before running tests.
 */
export async function waitForApi(page: Page): Promise<void> {
  await page.request.get(`${API_URL}/health/live`, { timeout: 15_000 });
}
