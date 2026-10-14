import { test, expect, request as pwRequest } from '@playwright/test';
import { apiLogin, injectAuthToken, logout, DEMO_ACCOUNTS, API_URL } from './helpers';

const PATIENT = DEMO_ACCOUNTS.patient;
let patientToken: string;

test.describe('Patient Journey', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    patientToken = await apiLogin(ctx, PATIENT.email, PATIENT.password);
    await ctx.dispose();
  });

  test('should render registration page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
  });

  test('should login successfully as patient (token injection)', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await page.goto('/patient/dashboard');
    await expect(page).toHaveURL(/\/patient/);
  });

  test('should display blood request form', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: /blood request|request/i })).toBeVisible();
  });

  test('should show urgency EMERGENCY option in create request form', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await page.goto('/requests');
    const emergencyOption = page.getByText(/emergency/i).first();
    await expect(emergencyOption).toBeVisible();
  });

  test('should display blood request list or empty state', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await page.goto('/requests');
    // Wait for the table rows to be visible (handles loading state automatically)
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
    const rowText = await page.locator('table tbody tr').first().innerText();
    expect(rowText.length).toBeGreaterThan(0);
  });

  test('should navigate to emergency map page', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await page.goto('/emergency-map');
    await expect(page.getByRole('heading', { name: /emergency|map|availability/i })).toBeVisible();
  });

  test('should block patient access to admin panel', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/access-denied/);
  });

  test('should logout patient and redirect to login', async ({ page }) => {
    await injectAuthToken(page, patientToken);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
