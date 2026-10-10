// Opening the app: sign in as a guest, say who you are, land in your part of the app, switch to another
// with the round red button, come back to where you left off, and sign out.
import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test('a new guest picks who they are, switches, and comes back where they left off', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: /Continue as guest/ }).click();

  await expect(page).toHaveURL(/tab=who/);
  await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  // The back button returns to sign-in.
  await page.goBack();
  await expect(page.getByRole('button', { name: /Continue as guest/ })).toBeVisible();
  await page.goForward();

  await page.getByRole('button', { name: /I'm a principal or teacher/ }).click();
  await expect(page).toHaveURL(/\/shala$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Saans Shala' })).toBeVisible();
  // Saans Shala's advice is written for the principal now.
  expect(await page.evaluate(() => localStorage.getItem('saans_user_role'))).toBe('principal');

  // The red button beside the tab bar opens the sheet; Ghar ki Hawa from there.
  await page.locator('#saans-switch').click();
  const sheet = page.getByRole('dialog', { name: 'Switch to' });
  await expect(sheet.getByRole('button', { name: /Saans Shala/ })).toHaveAttribute('aria-current', 'page');
  await sheet.getByRole('button', { name: /Ghar ki Hawa/ }).click();
  await expect(page).toHaveURL(/\/ghar$/);
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Ghar ki Hawa' })).toBeVisible();

  // Opening the app again goes straight to where they left off.
  await page.goto('/');
  await expect(page).toHaveURL(/\/ghar$/);

  // The account button opens the same sheet; Escape closes it, and signing out goes back to sign-in.
  await page.locator('#saans-account').click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.locator('#saans-account').click();
  await sheet.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
});

test('a farmer lands in Kisan Saathi, in their language, and nothing is wider than the phone', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'ਪੰਜਾਬੀ' }).click();
  await page.getByRole('button', { name: /ਮਹਿਮਾਨ ਵਜੋਂ ਅੱਗੇ ਵਧੋ/ }).click();
  await page.locator('#saans-who-farmer').click();
  await expect(page).toHaveURL(/\/kisan$/);
  await expect(page.getByRole('heading', { level: 1, name: 'ਕਿਸਾਨ ਸਾਥੀ' })).toBeVisible();
  await expect(page.locator('#saans-switch')).toContainText('ਬਦਲੋ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
