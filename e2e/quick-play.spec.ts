import { expect, test } from '@playwright/test';

import { activateWithKeyboard, gotoReady, playRoundToCompletion } from './helpers';

test('keyboard-only Quick Play run start to finish', async ({ page }) => {
  await gotoReady(page, '/');
  await expect(page.getByRole('heading', { name: 'Typester' })).toBeVisible();

  await activateWithKeyboard(page.getByRole('button', { name: 'Quick Play' }));
  await page.waitForURL('**/play/quick/mixed/90');

  await playRoundToCompletion(page, 12);
  await page.waitForURL('**/results', { timeout: 15_000 });

  await expect(page.locator('.results__grid')).toBeVisible();
  await expect(page.getByText('Score', { exact: true })).toBeVisible();
});

test('Play Again from results starts a fresh round with the same config', async ({ page }) => {
  await page.goto('/play/quick/mixed/90');
  await playRoundToCompletion(page, 12);
  await page.waitForURL('**/results', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Play Again' }).click();
  await page.waitForURL('**/play/quick/mixed/90');
  await expect(page.locator('.game__word')).toBeVisible();
});

test('Menu from results returns home', async ({ page }) => {
  await page.goto('/play/quick/mixed/90');
  await playRoundToCompletion(page, 12);
  await page.waitForURL('**/results', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForURL('**/');
  await expect(page.getByRole('heading', { name: 'Typester' })).toBeVisible();
});
