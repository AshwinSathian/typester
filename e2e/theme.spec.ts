import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

test('switching theme in Settings applies data-theme and persists it', async ({ page }) => {
  await gotoReady(page, '/settings');
  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' });

  await themeGroup.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await themeGroup.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await themeGroup.getByRole('radio', { name: 'System' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});
