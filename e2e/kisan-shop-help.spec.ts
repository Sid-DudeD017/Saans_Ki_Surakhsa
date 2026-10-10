// The Shop and Help tabs end to end on a phone-sized screen in demo mode: what fits Gurpreet's farm,
// renting from a CHC, Sangrur's numbers, and a complaint that becomes a ticket.
import { devices, expect, test, type Page } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

const GURPREET = {
  location: { village: 'Bhawanigarh' },
  paddyAcres: 18,
  tractors: 1,
  harvestDate: '2026-10-20',
  wheatBy: '2026-11-09',
  machines: [{ id: 'a', type: 'super_seeder', count: 1, owned: false, days: 2, addedAt: '2026-10-10T00:00:00Z' }],
};

async function asGurpreet(page: Page, tab: string) {
  await page.goto('/kisan');
  await page.evaluate((farm) => localStorage.setItem('saans_kisan_farm', JSON.stringify(farm)), GURPREET);
  await page.goto(`/kisan?tab=${tab}`);
}

test('the Shop ranks what fits the farm, and renting finds a CHC', async ({ page }) => {
  await asGurpreet(page, 'shop');
  const shop = page.locator('#kisan-panel-shop');
  const first = shop.getByRole('listitem').first();
  await expect(first).toContainText('Happy Seeder');
  await expect(first).toContainText('Fits your farm');
  await expect(first).toContainText('Clears your 7 acres left in about 1 day');
  await expect(shop.getByRole('listitem').filter({ hasText: 'PUSA' })).toContainText('Too late this season');

  const superSeeder = shop.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Super Seeder', exact: true }) });
  await expect(superSeeder).toContainText('up to ₹1,20,000');
  await superSeeder.getByRole('button', { name: /Rent from a CHC/ }).click();
  await expect(superSeeder).toContainText('Demo CHC A (Bhawanigarh)');
  await expect(superSeeder).not.toContainText('00000'); // placeholder phone numbers stay hidden
});

test("a complaint becomes a ticket the farmer can follow; Sangrur's numbers are shown", async ({ page }) => {
  await asGurpreet(page, 'help');
  const help = page.locator('#kisan-panel-help');
  await expect(help).toContainText('Chief Agriculture Officer, Sangrur');
  await expect(help).toContainText('01672-234220');
  await expect(help.getByRole('link', { name: /Call/ }).first()).toHaveAttribute('href', 'tel:112');

  await help.getByRole('button', { name: 'Start a complaint' }).click();
  await help.getByRole('button', { name: "The CHC machine didn't come" }).click();
  await help.getByRole('button', { name: 'Next' }).click();
  await page.locator('#kisan-complaint-chc').fill('Demo CHC A (Bhawanigarh)');
  await page.locator('#kisan-complaint-text').fill('Booked for 2 November. It never came.');
  await help.getByRole('button', { name: 'Next' }).click();
  await expect(help).toContainText('CHC: Demo CHC A (Bhawanigarh)');
  await help.getByRole('button', { name: /Send complaint/ }).click();

  await expect(help).toContainText('Complaint sent');
  const ticket = (await page.locator('#kisan-ticket-number').innerText()).trim();
  expect(ticket).toMatch(/^complaint-/);
  const mine = help.getByRole('listitem').filter({ hasText: ticket });
  await expect(mine).toContainText("The CHC machine didn't come");
  await expect(mine).toContainText('Received');

  // The demo officer picks it up a few seconds later.
  await page.waitForTimeout(5500);
  await help.getByRole('button', { name: /Refresh/ }).click();
  await expect(mine).toContainText('The officer has it');

  // It's still there after a reload.
  await page.reload();
  await expect(page.locator('#kisan-panel-help').getByRole('listitem').filter({ hasText: ticket })).toBeVisible();
});
