import { expect, test } from '@playwright/test';

import { gotoReady, playRoundToCompletion } from './helpers';

test('Game Modes: pick difficulty + duration, play, and reach results', async ({ page }) => {
  test.setTimeout(60_000);
  await gotoReady(page, '/');

  await page.getByRole('button', { name: 'Game Modes' }).click();
  await expect(page.locator('#mode-picker')).toBeVisible();

  await page
    .locator('#mode-picker app-segmented-control')
    .nth(1)
    .getByRole('radio', { name: 'Hard' })
    .click();
  await page
    .locator('#mode-picker app-segmented-control')
    .nth(2)
    .getByRole('radio', { name: '30s' })
    .click();
  await page.getByRole('button', { name: 'Start' }).click();

  await page.waitForURL('**/play/timed/hard/30');
  await expect(page.locator('.game__word')).toBeVisible();

  await playRoundToCompletion(page, 6);
  await page.waitForURL('**/results', { timeout: 40_000 });
  await expect(page.locator('.results__grid')).toBeVisible();
});

test('an invalid /play route redirects home', async ({ page }) => {
  await page.goto('/play/timed/impossible/999');
  await page.waitForURL('**/');
  await expect(page.getByRole('heading', { name: 'Typester' })).toBeVisible();
});
