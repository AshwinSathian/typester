import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

test('Keep playing resumes the same round', async ({ page }) => {
  await gotoReady(page, '/play/timed/easy/60');
  await expect(page.locator('.game__word')).toBeVisible();

  await page.getByRole('button', { name: 'Exit round' }).click();
  await expect(page.getByRole('heading', { name: 'Exit this round?' })).toBeVisible();

  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('heading', { name: 'Exit this round?' })).not.toBeVisible();
  await expect(page.locator('.game__word')).toBeVisible();
  await expect(page).toHaveURL(/\/play\/timed\/easy\/60/);
});

test('Escape opens the exit-confirm dialog', async ({ page }) => {
  await gotoReady(page, '/play/timed/easy/60');
  await expect(page.locator('.game__word')).toBeVisible();

  await page.locator('.game__input').press('Escape');
  await expect(page.getByRole('heading', { name: 'Exit this round?' })).toBeVisible();
});

test('Discard & exit returns home without visiting Results', async ({ page }) => {
  await gotoReady(page, '/play/timed/easy/60');

  const word = (await page.locator('.game__word').textContent())?.trim() ?? '';
  await page.locator('.game__input').fill(word);
  await page.locator('.game__input').press('Enter');

  await page.getByRole('button', { name: 'Exit round' }).click();
  await page.getByRole('button', { name: 'Discard & exit' }).click();

  await page.waitForURL('**/');
  await expect(page.getByRole('heading', { name: 'Typester' })).toBeVisible();
});

test('Save score & exit records the partial round and reaches Results', async ({ page }) => {
  await gotoReady(page, '/play/timed/easy/60');

  const word = (await page.locator('.game__word').textContent())?.trim() ?? '';
  await page.locator('.game__input').fill(word);
  await page.locator('.game__input').press('Enter');

  await page.getByRole('button', { name: 'Exit round' }).click();
  await page.getByRole('button', { name: 'Save score & exit' }).click();

  await page.waitForURL('**/results');
  await expect(page.locator('.results__grid')).toBeVisible();
});
