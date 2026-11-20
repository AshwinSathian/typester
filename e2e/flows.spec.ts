import { expect, test } from '@playwright/test';

import { currentWord, gotoReady, typeWords } from './helpers';

test('typing the hero word starts a Rush', async ({ page }) => {
  await gotoReady(page, '/');
  await page.keyboard.type('typester', { delay: 20 });
  await expect(page).toHaveURL(/\/play\/rush$/);
  await expect(page.locator('#field')).toBeFocused();
});

test('number keys pick a mode', async ({ page }) => {
  await gotoReady(page, '/');
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/\/play\/sprint$/);
});

test('a Sprint run: words, a miss, Esc, results, Enter to replay', async ({ page }) => {
  await gotoReady(page, '/play/sprint');
  await expect(page.locator('.hud__clock')).toContainText('60');
  await typeWords(page, 4);

  const word = await currentWord(page);
  const wrong = word[0] === 'q' ? 'z' : 'q';
  await page.keyboard.press(wrong);
  await expect(page.locator('app-keycap-word')).toHaveAttribute('data-miss', '1');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sprint');
  await expect(page.getByText('New best')).toBeVisible();
  await expect(page.getByText(/missed key/)).toBeVisible();

  // Enter replays after the short grace period.
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  await expect(page.locator('#field')).toBeVisible();
});

test('the best shows on the home screen and the stats page', async ({ page }) => {
  await gotoReady(page, '/play/rush');
  await typeWords(page, 3);
  await page.keyboard.press('Escape');
  await expect(page.getByText('New best')).toBeVisible();

  await page.getByRole('link', { name: /Menu/ }).click();
  await expect(page.getByRole('button', { name: /^Rush/ })).toContainText('Best');
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Bests' })).toBeVisible();
});

test('a challenge link shows the score to beat and carries it into the run', async ({ page }) => {
  await gotoReady(page, '/?mode=sprint&vs=1240');
  await expect(page.getByText('Someone scored 1,240 in Sprint')).toBeVisible();
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/\/play\/sprint\?vs=1240$/);
  await expect(page.getByText('To beat')).toBeVisible();
});

test('settings persist across a reload', async ({ page }) => {
  await gotoReady(page, '/settings');
  await page.getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
});

test('an unknown mode goes home', async ({ page }) => {
  await gotoReady(page, '/play/nope');
  await expect(page).toHaveURL(/\/$/);
});
