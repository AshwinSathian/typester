import { Page, expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Collects the first `count` words of a round, waiting for each correct
 *  submission to actually advance the round before reading the next word -
 *  avoids a race between reading and the DOM settling on the new word. */
async function collectWords(page: Page, count: number): Promise<string[]> {
  const wordLocator = page.locator('.game__word');
  const inputLocator = page.locator('.game__input');
  const words: string[] = [];

  for (let i = 0; i < count; i++) {
    await expect(wordLocator).toBeVisible();
    const word = (await wordLocator.textContent())?.trim() ?? '';
    words.push(word);

    await inputLocator.fill(word);
    await inputLocator.press('Enter');
    if (i < count - 1) {
      await expect(wordLocator).not.toHaveText(word);
    }
  }

  return words;
}

test('daily challenge produces identical word order across two independent sessions', async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const date = todayUtc();

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await gotoReady(pageA, `/play/daily/${date}`);
  const wordsA = await collectWords(pageA, 5);
  await contextA.close();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await gotoReady(pageB, `/play/daily/${date}`);
  const wordsB = await collectWords(pageB, 5);
  await contextB.close();

  expect(wordsA).toEqual(wordsB);
});

test("the Home CTA starts today's daily challenge, sub-branded on Results", async ({ page }) => {
  test.setTimeout(30_000);
  await gotoReady(page, '/');
  await page.locator('.home__daily-cta').click();
  await page.waitForURL(`**/play/daily/${todayUtc()}`);
  await expect(page.locator('.game__word')).toBeVisible();

  const word = (await page.locator('.game__word').textContent())?.trim() ?? '';
  await page.locator('.game__input').fill(word);
  await page.locator('.game__input').press('Enter');
  await page.getByRole('button', { name: 'Exit round' }).click();
  await page.getByRole('button', { name: 'Save score & exit' }).click();

  await page.waitForURL('**/results');
  await expect(page.locator('.results__eyebrow')).toContainText('Typester Daily #');
});

test('an invalid daily date redirects home', async ({ page }) => {
  await page.goto('/play/daily/2999-01-01');
  await page.waitForURL('**/');
});
