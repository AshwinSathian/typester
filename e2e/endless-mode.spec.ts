import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

test('picking Endless mode plays with a lives-remaining indicator and ends on the last mistake', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await gotoReady(page, '/');

  await page.getByRole('button', { name: 'Game Modes' }).click();
  await page
    .locator('#mode-picker app-segmented-control')
    .first()
    .getByRole('radio', { name: 'Endless' })
    .click();
  await page
    .locator('#mode-picker app-segmented-control')
    .nth(2)
    .getByRole('radio', { name: '3 lives' })
    .click();
  await page.getByRole('button', { name: 'Start' }).click();

  await page.waitForURL('**/play/endless/easy/3');
  await expect(page.locator('app-timer-ring')).toHaveCount(0);
  await expect(page.locator('.game__life-dot')).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    await page.locator('.game__input').fill('zzz-not-a-real-word');
    await page.locator('.game__input').press('Enter');
  }

  await page.waitForURL('**/results', { timeout: 15_000 });
  await expect(page.locator('.results__grid')).toBeVisible();
});

test('an out-of-range Endless lives count redirects home', async ({ page }) => {
  await page.goto('/play/endless/easy/7');
  await page.waitForURL('**/');
});
