import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { gotoReady, typeWords } from './helpers';

const pages = ['/', '/?mode=rush&vs=900', '/play/rush', '/stats', '/settings', '/privacy'];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    for (const path of pages) {
      test(`${path} has no serious axe violations`, async ({ page }) => {
        await gotoReady(page, path);
        const { violations } = await new AxeBuilder({ page }).analyze();
        const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
        expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
      });
    }

    test('results and a filled stats page have no serious axe violations', async ({ page }) => {
      await gotoReady(page, '/play/sprint');
      await typeWords(page, 3);
      await page.keyboard.press('x');
      await page.keyboard.press('Escape');
      await expect(page.getByText('New best')).toBeVisible();
      for (const check of [null, '/stats']) {
        if (check) await gotoReady(page, check);
        await page.waitForTimeout(500);
        const { violations } = await new AxeBuilder({ page }).analyze();
        const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
        expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
      }
    });
  });
}

// Gold words are random, and axe can't measure text over the play screen's
// gradient, so compute the gold text's contrast against the page colour.
for (const theme of ['light', 'dark'] as const) {
  test(`gold text has 4.5:1 contrast in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await gotoReady(page, '/play/rush');
    const ratio = await page.evaluate(() => {
      const span = document.querySelector('.stage__next span')!;
      span.classList.add('stage__next--gold');
      const rgb = (css: string) => {
        const probe = document.createElement('i');
        probe.style.color = css;
        document.body.append(probe);
        const [r, g, b] = getComputedStyle(probe).color.match(/\d+/g)!.map(Number);
        probe.remove();
        return [r, g, b];
      };
      const lum = ([r, g, b]: number[]) => {
        const c = [r, g, b].map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const fg = lum(rgb(getComputedStyle(span).color));
      const bg = lum(rgb('var(--bg)'));
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
