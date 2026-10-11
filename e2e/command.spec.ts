// Saans Command as its own part of the app: the case list, a map you can move and zoom, and one case.
import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test('an officer finds a case on the list and on the map, and opens it', async ({ page }) => {
  await page.goto('/command');
  await expect(page.getByRole('heading', { level: 1, name: 'Saans Command' })).toBeVisible();
  const bar = page.getByRole('navigation', { name: 'Command sections' });
  await expect(bar.getByRole('tab')).toHaveText(['📋Cases', '🗺️Map', '📁Case']);
  // Officers act on reports; the shell's Report button isn't here.
  await expect(page.getByRole('button', { name: /Report Smoke/ })).toHaveCount(0);

  // The list: tap a case and it opens on the Case tab.
  const first = page.locator('#command-panel-cases [data-case]').first();
  const id = await first.getAttribute('data-case');
  await first.click();
  await expect(page).toHaveURL(/tab=case/);
  await expect(page.locator('#command-panel-case')).toContainText(id!);
  await page.getByRole('button', { name: '← All cases' }).click();
  await expect(page.locator('#command-panel-cases')).toBeVisible();

  // The map: zoom with the buttons, drag it, and tap a pin to see that case.
  await page.getByRole('tab', { name: /Map/ }).click();
  const map = page.locator('#command-panel-map [role=application]');
  await expect(map).toHaveAttribute('data-zoom', /\d+/);
  const zoom = Number(await map.getAttribute('data-zoom'));
  await page.locator('#command-panel-map').getByRole('button', { name: 'Zoom out' }).click();
  await expect(map).toHaveAttribute('data-zoom', String(zoom - 1));
  const before = await map.getAttribute('data-centre');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('data-centre', before!);
  await page.locator('#command-panel-map').getByRole('button', { name: 'Show every pin' }).click();
  await expect(map).toHaveAttribute('data-zoom', String(zoom));

  await map.locator('[data-pin]').first().click();
  await page.locator('#command-panel-map').getByRole('button', { name: /Open case →/ }).click();
  await expect(page).toHaveURL(/tab=case/);
  await expect(page.locator('#command-panel-case [role=application]')).toBeVisible();
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
