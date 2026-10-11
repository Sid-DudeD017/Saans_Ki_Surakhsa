// Saans Command as its own part of the app (P4's console on the shared tab bar), and Ghar ki Hawa's home figure.
import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test("Command is P4's console on the app's tab bar", async ({ page }) => {
  await page.goto('/command');
  await expect(page.getByRole('heading', { level: 1, name: 'Saans Command' })).toBeVisible();
  const bar = page.getByRole('navigation', { name: 'Command sections' });
  await expect(bar.getByRole('tab')).toHaveText(['📋Cases', '🗺️Map', '📁Case']);
  // Officers act on reports; the shell's Report button isn't here, and nor is a demo banner.
  await expect(page.getByRole('button', { name: /Report Smoke/ })).toHaveCount(0);
  await expect(page.getByText('Example cases')).toHaveCount(0);

  // The queue is the first tab; the map and the open case are a tab each, in the URL.
  await expect(page.locator('#command-panel-cases')).toBeVisible();
  await page.getByRole('tab', { name: /Map/ }).click();
  await expect(page).toHaveURL(/tab=map/);
  await expect(page.locator('#command-panel-map')).toBeVisible();
  await expect(page.locator('#command-panel-cases')).toBeHidden();
  await page.getByRole('tab', { name: /Case$/ }).click();
  await expect(page).toHaveURL(/tab=case/);
  await expect(page.locator('#command-panel-case')).toContainText('Pick a case');
  await page.goBack();
  await expect(page.getByRole('tab', { name: /Map/ })).toHaveAttribute('aria-selected', 'true');
});

test('the Switch sheet opens Command, and Command marks itself there', async ({ page }) => {
  await page.goto('/ghar');
  await page.locator('#saans-switch').click();
  await page.getByRole('dialog', { name: 'Switch to' }).getByRole('button', { name: /Open Command/ }).click();
  await expect(page).toHaveURL(/\/command$/);
  await page.locator('#saans-switch').click();
  await expect(page.getByRole('dialog', { name: 'Switch to' }).getByRole('button', { name: /Open Command/ })).toHaveAttribute('aria-current', 'page');
});

test("Ghar ki Hawa's home figure is an AQI, never above 500, from rooms weighted by size", async ({ page }) => {
  await page.goto('/ghar');
  const home = page.locator('#ghar-panel-air section[aria-labelledby=ghar-home]');
  await expect(home.locator('[data-aqi]')).toBeVisible();
  const shown = await home.locator('[data-aqi]').getAttribute('data-aqi');
  expect(shown === '500+' || Number(shown) <= 500).toBe(true);
  await home.getByText('How is this worked out?').click();
  await expect(home).toContainText('Σ (room PM2.5 × room volume) ÷ Σ room volume');
});
