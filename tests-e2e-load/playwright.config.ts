import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration — Rakthayatra (LifeLink)
 *
 * Runs all spec files in the `playwright/` directory against a locally
 * running frontend (default: http://localhost:3000) and backend API
 * (default: http://localhost:5000).
 *
 * Set BASE_URL and API_URL env vars to override for staging/CI.
 *
 * Worker count is capped at 2 to prevent rate-limit collisions:
 * express-rate-limit (loginLimiter) allows 5 attempts per IP per 15min.
 * With >2 parallel workers, concurrent login attempts from the same IP
 * can exhaust the quota and block functional login tests.
 * The security spec is isolated into its own project (runs last).
 */
export default defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  workers: 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // --- Functional journeys: run across all three browsers ---
    {
      name: 'chromium',
      testIgnore: '**/security.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: '**/security.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Mobile Safari (iOS)',
      testIgnore: '**/security.spec.ts',
      use: { ...devices['iPhone 14'] },
    },
    // --- Security spec: isolated, runs last ---
    // The rate-limit test fires 5 bad logins and would exhaust the IP quota
    // for all parallel login tests if run concurrently.
    {
      name: 'security',
      testMatch: '**/security.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
