// K12: the Machines tab end to end, on a phone-sized screen in demo mode (NEXT_PUBLIC_USE_MOCKS, the
// default): fill the farm card, photograph a machine, confirm it, and see Gurpreet's verdict and plan.
import path from 'node:path';

import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test("Gurpreet's rented Super Seeder isn't enough; a CHC booking gets him to 92%", async ({ page }) => {
  await page.goto('/kisan?tab=machines');
  const machines = page.locator('#kisan-panel-machines');

  await machines.getByRole('button', { name: 'Add farm details' }).click();
  await page.locator('#kisan-farm-paddyAcres').fill('18');
  await page.locator('#kisan-farm-tractors').fill('1');
  await page.locator('#kisan-farm-harvestDate').fill('2026-10-20');
  await page.locator('#kisan-farm-wheatBy').fill('2026-11-09');
  await machines.getByRole('button', { name: 'Save' }).click();
  await expect(machines.getByText('Paddy 18 acres · Tractors 1')).toBeVisible();

  // The camera button's input; Playwright hands it the photo as if the camera took it.
  await machines.locator('input[type=file][capture]').setInputFiles(path.join(__dirname, 'fixtures', 'machine.jpg'));
  await expect(machines.getByText('This looks like a Super Seeder')).toBeVisible();
  await expect(machines.getByRole('button', { name: 'Super Seeder', pressed: true })).toBeVisible();

  await machines.getByRole('button', { name: 'Rented' }).click();
  await expect(machines.getByRole('group', { name: 'For how many days?' })).toContainText('2');
  await machines.getByRole('button', { name: /Add to my machines/ }).click();
  await expect(machines.getByText('1 × Super Seeder')).toBeVisible();
  await expect(machines.getByText('Rented · 2 days')).toBeVisible();

  await machines.getByRole('button', { name: 'Work it out' }).click();
  const verdict = machines.getByRole('status').filter({ hasText: 'Not enough' });
  await expect(verdict).toContainText('61%');
  await expect(verdict).toContainText('11 of 18 acres cleared by 9 Nov without fire');
  await expect(verdict).toContainText('7 acres left: about 17.5 t of straw');

  // The plan needs the farm's location; without it the button says so.
  await machines.getByRole('button', { name: /Find CHC machines/ }).click();
  await expect(machines.getByRole('alert')).toContainText('Set your farm location');
  await page.getByRole('button', { name: 'Set location' }).click();
  await page.locator('#kisan-village').fill('Bhawanigarh');
  await page.getByRole('button', { name: 'Save' }).click();
  await machines.getByRole('button', { name: /Find CHC machines/ }).click();
  await expect(machines.getByText('With these: 92%')).toBeVisible();
  await expect(machines.getByText('Still short: 1.5 acres')).toBeVisible();

  // Nothing is booked from here: the farmer asks in the conversation.
  await machines.getByRole('button', { name: /Ask in the conversation/ }).click();
  await expect(page).toHaveURL(/\/kisan$/);
  await expect(page.locator('#kisan-panel-plan')).toBeVisible();
});

test('the tab is in the URL and the back button returns to it', async ({ page }) => {
  await page.goto('/kisan?tab=help');
  await expect(page.locator('#kisan-panel-help')).toContainText('Emergency (police, fire, ambulance)');
  await page.getByRole('tab', { name: 'Shop' }).click();
  await expect(page).toHaveURL(/tab=shop/);
  await page.goBack();
  await expect(page.locator('#kisan-panel-help')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Help' })).toHaveAttribute('aria-selected', 'true');
});
