# Typester

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-typester.ashwinsathian.com-2ea44f)](https://typester.ashwinsathian.com)

A typing game where every word buys time. Words appear as a row of keycaps;
each correct letter presses its key down and plays the next note of a tune.
There is no Enter and no backspace: the last letter finishes the word, and a
wrong key never enters it.

- **Rush**: start with 15 seconds. Each word adds time, but words get longer
  and each level pays 12% less per letter, so every run ends.
- **Sprint**: sixty seconds, as many words as you can.
- **Daily**: a Rush with the same words for every player that day.
- **Drill**: forty-five seconds of words full of the letters you miss most,
  worked out from every key you have typed.

Clean keystrokes build a multiplier from ×1 to ×5; one miss drops it back to
×1. Gold words score double. While you play, a counter shows how many words
ahead of or behind your best run you are at that second. Results show your
run against that best as a chart, and a keyboard tinted by where you missed.
Share sends an image card and a link that opens Typester with your score as
the one to beat.

Live at [typester.ashwinsathian.com](https://typester.ashwinsathian.com).
Installable, works offline, light and dark themes, reduced-motion support.

[ARCHITECTURE.md](./ARCHITECTURE.md) covers how it is built and why.
[DESIGN-typester.md](./DESIGN-typester.md) covers the design tokens and
screen rules.

## Stack

Angular 22 (zoneless, standalone, signals), Tailwind CSS v4, Vitest,
Playwright with axe-core, Cloudflare Workers static assets.

## Development

Needs Node ≥22.22.3, ≥24.15.0 or ≥26.0.0 (`.nvmrc` pins one).

```bash
npm install
npm run start          # dev server at http://localhost:4200
npm test               # Vitest unit and component tests
npm run lint
npx playwright test    # e2e and axe checks in Chromium, WebKit and mobile Safari
npm run build          # static, prerendered output in dist/typester/browser
```

A pre-commit hook runs Prettier and ESLint on staged files.

## Deployment

Cloudflare Workers Builds watches `main`. Each push runs
`npm run build -- --configuration production` and `npx wrangler deploy`,
which serves `dist/typester/browser` as static assets with single-page-app
fallback (`wrangler.jsonc`).
