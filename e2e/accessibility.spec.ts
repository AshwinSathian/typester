import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { gotoReady } from './helpers';

const routes = ['/', '/help', '/settings', '/privacy', '/terms', '/license'];
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
