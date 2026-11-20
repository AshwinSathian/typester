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
