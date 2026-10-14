import { Page, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Environment constants
// ---------------------------------------------------------------------------
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
export const API_URL  = process.env.API_URL  ?? 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Seeded demo accounts (matching backend/prisma/seed.js)
// ---------------------------------------------------------------------------
export const DEMO_ACCOUNTS = {
  admin:     { email: 'admin@lifelink.org',    password: 'Admin@1234',   role: 'ADMIN' },
  donor:     { email: 'aman.jain@donor.org',   password: 'Donor@1234',   role: 'DONOR' },
  patient:   { email: 'patient@lifelink.org',  password: 'Patient@1234', role: 'PATIENT' },
  hospital:  { email: 'apollo@lifelink.org',   password: 'Hosp@1234',    role: 'HOSPITAL' },
  bloodbank: { email: 'citybank@lifelink.org', password: 'Bank@1234',    role: 'BLOOD_BANK' },
} as const;

// ---------------------------------------------------------------------------
// API login — returns the access token WITHOUT touching the browser UI.
// Use this in beforeAll to obtain a token once per spec file, then inject
// it into browser localStorage so individual tests don't have to call
// the login form (and won't consume rate-limit quota per test).
// ---------------------------------------------------------------------------
export async function apiLogin(
  apiContext: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await apiContext.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`API login failed for ${email}: ${res.status()} — ${body}`);
  }
  const json = await res.json();
  return json.data.accessToken as string;
}

// ---------------------------------------------------------------------------
// Inject a JWT into localStorage so Playwright treats the browser as logged in.
// The AuthContext restores session only when BOTH ll_access_token AND ll_user
// are set. We fetch the user profile via /api/auth/me and write both keys.
// Call this before any page.goto() that requires authentication.
// ---------------------------------------------------------------------------
export async function injectAuthToken(page: Page, token: string): Promise<void> {
  // Fetch user profile from the live API using the token
  const apiCtx = await page.context().request;
  const userRes = await apiCtx.get(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let userJson: Record<string, unknown> = {};
  if (userRes.ok()) {
    const body = await userRes.json();
    userJson = body?.data?.user ?? {};
  }

  // Navigate to root so localStorage is scoped to the app origin
  await page.goto('/');
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('ll_access_token', t as string);
      localStorage.setItem('ll_user', JSON.stringify(u));
    },
    [token, userJson],
  );
}


// ---------------------------------------------------------------------------
// Full UI login — only used in tests that explicitly need to test the login
// form (e.g., bad-password rejection). NOT used in beforeAll.
// ---------------------------------------------------------------------------
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(
    (url) => !url.pathname.endsWith('/login') && !url.pathname.endsWith('/verify-otp'),
    { timeout: 15_000 },
  );
}

// Keep the old name as an alias so security.spec.ts (which needs to test the UI form) still works
export const loginAs = loginViaUI;

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
}

// ---------------------------------------------------------------------------
// Toast assertion
// ---------------------------------------------------------------------------
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator('[data-hot-toast], .go2072408551, [role="status"]').first()).toContainText(text, {
    timeout: 8_000,
  });
}
