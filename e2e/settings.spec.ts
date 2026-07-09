import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

test('settings persist across a full page reload', async ({ page }) => {
  await gotoReady(page, '/settings');

  const soundToggle = page.getByRole('switch', { name: 'Sound' });
  await expect(soundToggle).toHaveAttribute('aria-checked', 'true');
  await soundToggle.click();

  await page
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'Dark' })
    .click();

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(
    page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('an out-of-range Quick Play duration shows a validation error', async ({ page }) => {
  await gotoReady(page, '/settings');
  const durationInput = page.locator('#quick-duration');

  // Triple-click to select the field's full contents before typing - a
  // low-level value+event dispatch gets silently reverted by FormField,
  // and real trusted keystrokes are what actually exercise the validator.
  await durationInput.click({ clickCount: 3 });
  await durationInput.pressSequentially('999', { delay: 30 });

  await expect(page.locator('.settings__error')).toBeVisible();
});

test('Back to Menu returns home', async ({ page }) => {
  await gotoReady(page, '/settings');
  await page.getByRole('button', { name: 'Back to Menu' }).click();
  await page.waitForURL('**/');
});
