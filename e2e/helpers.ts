import { Page } from '@playwright/test';

/** Prerendered pages hydrate after first paint; wait so input isn't dropped. */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

export async function currentWord(page: Page): Promise<string> {
  const label = await page.locator('#field').getAttribute('aria-label');
  return (label ?? '').replace('Type the word: ', '');
}

/** Types the words on screen, one key at a time, like a person would. */
export async function typeWords(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const word = await currentWord(page);
    await page.keyboard.type(word, { delay: 15 });
    await page.waitForFunction(
      (w) => !document.querySelector('#field')?.getAttribute('aria-label')?.endsWith(` ${w}`),
      word,
    );
  }
}
