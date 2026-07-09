import { Locator, Page, expect } from '@playwright/test';

/**
 * Prerendered routes hydrate client-side after the initial paint;
 * interacting with the page before hydration finishes attaching Angular's
 * event listeners can silently drop the interaction once hydration
 * reconciles the DOM back to the component's actual state. Waiting for
 * network idle is a reliable-in-practice proxy for "hydration is done".
 */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/** Focuses the element and presses Enter - exercises keyboard activation
 * without depending on the exact tab order (covered separately by axe). */
export async function activateWithKeyboard(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.press('Enter');
}

/** Reads the current word, types it, and submits with Enter - repeats until /results. */
export async function playRoundToCompletion(page: Page, maxWords = 12): Promise<void> {
  const wordLocator = page.locator('.game__word');
  const inputLocator = page.locator('.game__input');

  for (let i = 0; i < maxWords; i++) {
    if (page.url().includes('/results')) return;
    await expect(wordLocator).toBeVisible();
    const word = (await wordLocator.textContent())?.trim() ?? '';
    await inputLocator.fill(word);
    await inputLocator.press('Enter');
    await page.waitForTimeout(50);
  }
}
