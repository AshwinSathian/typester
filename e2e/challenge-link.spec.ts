import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

test('opening a challenge link lands on the challenge frame and Accept starts that exact config', async ({
  page,
}) => {
  await gotoReady(page, '/?mode=timed&difficulty=hard&duration=60&score=412&wpm=88');

  await expect(page.locator('.home__challenge')).toBeVisible();
  await expect(page.locator('.home__challenge-copy')).toContainText('412 pts');
  await expect(page.locator('.home__challenge-copy')).toContainText('88 WPM');

  await page.getByRole('button', { name: 'Accept Challenge' }).click();
  await page.waitForURL('**/play/timed/hard/60');
  await expect(page.locator('.game__word')).toBeVisible();
});

test('"Play Typester normally" dismisses the challenge frame back to the standard hero', async ({
  page,
}) => {
  await gotoReady(page, '/?mode=timed&difficulty=hard&duration=60&score=412&wpm=88');

  await page.getByRole('button', { name: 'Play Typester normally' }).click();
  await page.waitForURL('**/');
  await expect(page.locator('.home__hero')).toBeVisible();
  await expect(page.locator('.home__challenge')).not.toBeVisible();
});

test('malformed challenge-link params fall back to the standard hero', async ({ page }) => {
  await gotoReady(page, '/?mode=bogus&difficulty=hard&duration=60&score=412&wpm=88');
  await expect(page.locator('.home__hero')).toBeVisible();
  await expect(page.locator('.home__challenge')).not.toBeVisible();
});
