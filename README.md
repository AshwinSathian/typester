# Typester

A keyboard-first typing speed game. A word appears, you type it, you race the
clock — chase a streak multiplier, catch power words for bonus points, and
beat your best score.

- **Quick Play, Timed, and Endless/Survival modes**, plus a **Typester
  Daily** challenge with the same words for every player each day.
- **Live WPM and a word look-ahead queue** during play, with distinct
  correct/near-miss/incorrect feedback (color, motion, and sound).
- **Streak combo multiplier and power words** layered on top of base
  scoring, plus a fixed **achievement set** and a **Stats screen** tracking
  day streak, best scores across all mode/difficulty/duration combos, and
  unlocked achievements.
- **Shareable results** — a themed, client-side-rendered image card, or a
  text/clipboard fallback — and **challenge links** that let a friend land
  on a "beat this score?" screen.
- **Optional themed word packs** (Movies & TV, Tech/Programming, Science,
  Everyday) for Timed/Endless rounds, alongside the default live word
  source with an offline-safe bundled fallback.
- Installable **PWA**, fully playable offline, light/dark theme and
  reduced-motion support, WCAG AA accessibility.

Live at [typester.ashwinsathian.com](https://typester.ashwinsathian.com).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the technical architecture and
key decisions, and [DESIGN-typester.md](./DESIGN-typester.md) for the design
system spec (tokens, components, screen-by-screen behavior).

## Stack

Angular 22 · zoneless · standalone · signals · Signal Forms · Tailwind CSS v4
· Vitest · Playwright · Cloudflare Pages.

## Requirements

- Node ≥22.22.3, ≥24.15.0, or ≥26.0.0 (see `.nvmrc`; run `nvm use` if you
  manage Node versions with `nvm`).

## Development

```bash
nvm use               # if using nvm - picks up .nvmrc
npm install
npm run start          # dev server at http://localhost:4200
npm test               # Vitest unit/component tests
npm run lint           # ESLint (angular-eslint)
npm run format         # Prettier --write
npx playwright test    # e2e + accessibility (axe) across chromium/webkit/mobile
```

A pre-commit hook (`simple-git-hooks` + `lint-staged`) runs Prettier and
ESLint on staged files automatically.

## Build

```bash
npm run build
```

Produces a fully static, prerendered site in `dist/typester/browser` — no
Node server required at runtime (see ARCHITECTURE.md §D2 for why).

## Deployment

Cloudflare Pages, Git-connected to this repo. Every push to `main` triggers a
build (`npm run build -- --configuration production`) and deploy — no GitHub
Actions, no local infrastructure. Custom domain: `typester.ashwinsathian.com`.

## Project structure

```
src/app/
  core/       singleton services, functional guards, shared models
  features/   home, game, results, stats, settings, help, legal — one folder per route
  shared/     ui/  — presentational design-system primitives
              data/ — bundled word bank + themed word packs (offline fallback)
e2e/          Playwright specs (flows + axe accessibility)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for routes, data flow, and the full
key-decisions log.
