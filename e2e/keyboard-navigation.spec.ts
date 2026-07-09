import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

test('Home is reachable end to end using only Tab and Enter, no mouse', async ({
  page,
  browserName,
}) => {
  // WebKit only includes buttons/links in the Tab order when the system-level
  // "Full Keyboard Access" setting is on (off by default in real Safari too)
  // - this is platform behavior, not something the app controls, so this
  // walk-the-tab-order check only runs where it's actually meaningful.
  test.skip(browserName === 'webkit', 'WebKit excludes buttons from Tab order by default');

  await gotoReady(page, '/');

  const seen: string[] = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const text = (
      await page
        .locator(':focus')
        .textContent()
        .catch(() => null)
    )?.trim();
    if (text) seen.push(text);
    if (text === 'Quick Play') break;
  }

  expect(seen).toContain('Quick Play');

  await page.keyboard.press('Enter');
  await page.waitForURL('**/play/quick/mixed/90');
});
