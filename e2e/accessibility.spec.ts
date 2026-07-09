import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const routes = [
  '/',
  '/help',
  '/settings',
  '/privacy',
  '/terms',
  '/license',
  '/stats',
  `/play/daily/${todayUtc()}`,
  '/?mode=timed&difficulty=hard&duration=60&score=412&wpm=88',
];
const themes: readonly ('light' | 'dark')[] = ['light', 'dark'];

for (const theme of themes) {
  test.describe(`axe accessibility (${theme} theme)`, () => {
    test.use({ colorScheme: theme });

    for (const route of routes) {
      test(`${route} has no serious/critical violations`, async ({ page }) => {
        await gotoReady(page, route);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

        const seriousOrWorse = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(seriousOrWorse, JSON.stringify(seriousOrWorse, null, 2)).toEqual([]);
      });
    }
  });
}
