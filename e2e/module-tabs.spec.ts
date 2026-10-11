// The bottom tab bar on Saans Shala and Ghar ki Hawa (the same bar as Kisan Saathi's): one part of the
// page per tab, the tab in the URL, the back button, arrow keys, and nothing wider than the phone.
import { devices, expect, test, type Page } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

const fitsTheScreen = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('Saans Shala: Today, Around, Learn, Play and Report', async ({ page }) => {
  await page.goto('/shala');
  const bar = page.getByRole('navigation', { name: 'Saans Shala sections' });
  await expect(bar.getByRole('tab')).toHaveText(['☀️Today', '🗺️Around', '📚Learn', '🎮Play', '📢Report']);
  await expect(page.getByRole('tab', { name: /Today/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#shala-panel-today')).toBeVisible();
  await expect(page.locator('#shala-panel-learn')).toBeHidden();

  // Around opens with its map section open; tapping its header there doesn't close it.
  await page.getByRole('tab', { name: /Around/ }).click();
  await expect(page).toHaveURL(/tab=around/);
  const around = page.locator('#shala-panel-around details');
  await expect(around).toHaveAttribute('open', '');
  await around.locator('summary').click();
  await expect(around).toHaveAttribute('open', '');
  await expect(page.locator('#shala-panel-today')).toBeHidden();

  // Play shows the activities with no Close link, and the location prompt stays on Today.
  await page.getByRole('tab', { name: /Play/ }).click();
  await expect(page.locator('#shala-panel-play')).toBeVisible();
  await expect(page.locator('#shala-panel-play')).not.toContainText('▲ Close');
  await expect(page.getByText('See the air where you are')).toHaveCount(0);

  // The back button returns to the previous tab.
  await page.goBack();
  await expect(page.getByRole('tab', { name: /Around/ })).toHaveAttribute('aria-selected', 'true');
  expect(await fitsTheScreen(page)).toBe(true);
});

test('Ghar ki Hawa: Air now, Rooms, What to do and Family', async ({ page }) => {
  await page.goto('/ghar');
  const bar = page.getByRole('navigation', { name: 'Ghar ki Hawa sections' });
  await expect(bar.getByRole('tab')).toHaveCount(4);
  await expect(page.locator('#ghar-panel-air')).toBeVisible();
  await expect(page.locator('#ghar-panel-rooms')).toBeHidden();

  // "Review rooms →" on the indoor card goes to the Rooms tab.
  await page.getByRole('button', { name: 'Review rooms →' }).click();
  await expect(page).toHaveURL(/tab=rooms/);
  await expect(page.locator('#ghar-panel-rooms')).toContainText('Your Rooms');
  expect(await fitsTheScreen(page)).toBe(true);

  // Arrow keys move along the bar, as in any tab list.
  await page.getByRole('tab', { name: /Rooms/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/tab=plan/);
  await expect(page.getByRole('tab', { name: /What to do/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ghar-panel-family')).toBeVisible();

  // A link straight to a tab opens it; the first tab has no ?tab.
  await page.goto('/ghar?tab=plan');
  await expect(page.locator('#ghar-panel-plan')).toBeVisible();
  // Enter, not a tap: in dev, Next.js's own "N" button sits over the first tab (not in the deployed app).
  await page.getByRole('tab', { name: /Air now/ }).press('Enter');
  await expect(page).toHaveURL(/\/ghar$/);
});
