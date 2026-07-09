import { expect, test } from '@playwright/test';

test('the notice banner never covers the last interactive element, and leaves no trace once dismissed', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  const banner = page.locator('.app-notice-banner');
  await expect(banner).toBeVisible();

  // An in-flow banner can only ever push content down, never cover it -
  // this used to fail when the banner was a `position: fixed` overlay,
  // which occupied the same screen region as the page's last button
  // regardless of scroll.
  await page.getByRole('button', { name: 'Back to Menu' }).click();
  await page.waitForURL('**/');

  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.locator('.app-notice-banner')).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.app-notice-banner')).toHaveCount(0);
});
