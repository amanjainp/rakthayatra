import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration — Rakthayatra (LifeLink)
 *
 * Runs all spec files in the `playwright/` directory against a locally
 * running frontend (default: http://localhost:3000) and backend API
 * (default: http://localhost:5000).
 *
 * Set BASE_URL and API_URL env vars to override for staging/CI.
 */
export default defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Mobile Safari (iOS)',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
