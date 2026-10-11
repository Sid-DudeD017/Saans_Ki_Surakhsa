// The Shop and Help tabs end to end on a phone-sized screen in demo mode: what fits Gurpreet's farm,
// renting from a CHC, Sangrur's numbers, and a complaint that becomes a ticket, texted to the farmer and
// escalated when nobody acts.
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

test('the Shop leads with the best way to close the gap, and Saathi books it', async ({ page }) => {
  await asGurpreet(page, 'shop');
  const shop = page.locator('#kisan-panel-shop');
  await expect(shop).toContainText('For your 7 acres left, before 9 Nov');

  // Demo CHCs: the only free machine nearby is CHC A's Super Seeder, on 2 Nov.
  const best = page.locator('#kisan-best');
  await expect(page.locator('#kisan-best-title')).toHaveText('Rent a Super Seeder');
  await expect(best).toContainText('Demo CHC A (Bhawanigarh) · 2 km');
  await expect(best).toContainText('5.5 acres');
  await expect(best).toContainText('₹5,500');
  await expect(best).toContainText('2 Nov');
  await expect(best).toContainText('Free only 1 day before your deadline');
  await expect(best).toContainText('1.5 acres still short');

  // The rest, grouped: what clears it all in time first, the decomposer too late.
  const inTime = shop.locator('section[aria-labelledby=kisan-shop-inTime]');
  await expect(inTime.getByRole('listitem').first()).toContainText('Happy Seeder');
  await expect(inTime.getByRole('listitem').first()).toContainText('Clears your 7 acres left in about 1 day');
  await expect(shop.locator('section[aria-labelledby=kisan-shop-other]').getByRole('listitem').filter({ hasText: 'PUSA' })).toContainText('Too late this season');

  // A row opens to its subsidy and the CHCs that rent it.
  const superSeeder = inTime.getByRole('listitem').filter({ hasText: /^Super Seeder/ });
  await expect(superSeeder).toContainText('Demo CHC A (Bhawanigarh): ₹5,500, free from 2 Nov');
  await superSeeder.getByRole('button', { expanded: false }).click();
  await expect(superSeeder).toContainText('up to ₹1,20,000');
  await superSeeder.getByRole('button', { name: /Rent from a CHC/ }).click();
  const chcA = superSeeder.getByRole('listitem').filter({ hasText: '₹1,000 an acre' });
  await expect(chcA).toContainText('Demo CHC A (Bhawanigarh)');
  await expect(chcA).toContainText('first free day: 2 Nov');
  await expect(superSeeder).not.toContainText('00000'); // placeholder phone numbers stay hidden

  // Booking goes through Saathi in the Plan conversation.
  await best.getByRole('button', { name: /Ask Saathi to book it/ }).click();
  await expect(page.locator('#kisan-panel-plan')).toContainText('Please book a Super Seeder from Demo CHC A (Bhawanigarh) for 5.5 acres, before 9 Nov.');
});

test("a complaint becomes a ticket the farmer can follow; Sangrur's numbers are shown", async ({ page }) => {
  test.setTimeout(90_000); // it waits out the demo officer and the demo deadline
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
  const phone = page.locator('#kisan-complaint-phone');
  await phone.fill('58765');
  await expect(help).toContainText('A mobile number has 10 digits');
  await expect(help.getByRole('button', { name: /Send complaint/ })).toBeDisabled();
  await phone.fill('98765 43210');
  await help.getByRole('button', { name: /Send complaint/ }).click();

  await expect(help).toContainText('Complaint sent');
  const ticket = (await page.locator('#kisan-ticket-number').innerText()).trim();
  expect(ticket).toMatch(/^complaint-/);
  await expect(page.locator('#kisan-ticket-sms')).toHaveText(/Ticket number texted to \+91\*{6}3210/); // K22
  const mine = help.getByRole('listitem').filter({ hasText: ticket });
  await expect(mine).toContainText("The CHC machine didn't come");
  await expect(mine).toContainText('Received');

  // The demo officer picks it up a few seconds later.
  await page.waitForTimeout(5500);
  await help.getByRole('button', { name: /Refresh/ }).click();
  await expect(mine).toContainText('The officer has it');
  await expect(mine).not.toContainText('No officer acted in time');

  // Nobody acts before the (demo) deadline: the number to call moves to the top of the ticket (K24).
  await page.waitForTimeout(10_000);
  await help.getByRole('button', { name: /Refresh/ }).click();
  await expect(mine).toContainText('No officer acted in time');
  await expect(mine.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:01672234220');
  const order = await mine.innerText();
  expect(order.indexOf('No officer acted in time')).toBeLessThan(order.indexOf(ticket));

  // It's still there after a reload.
  await page.reload();
  await expect(page.locator('#kisan-panel-help').getByRole('listitem').filter({ hasText: ticket })).toBeVisible();
});
