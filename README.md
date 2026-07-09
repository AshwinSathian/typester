# Typester

A word-typing speed game, rebuilt from the ground up as a modern Angular
application. A word appears, you type it, you race the clock.

This is a ground-up rewrite of a decade-old Angular 7 hobby project — see
[PLAN-typester.md](./PLAN-typester.md) for the full RFC (goals, architecture,
decisions, phased task breakdown) and [DESIGN-typester.md](./DESIGN-typester.md)
for the design system spec. Start there before writing any feature code.

## Status

Phase 1 (foundation & scaffolding) is complete. Phases 2–4 (game engine,
UI, PWA/launch) are planned but not yet built — see `PLAN-typester.md` for
the exact task list and acceptance criteria.

## Stack

Angular 22 · zoneless · standalone · signals · Tailwind CSS v4 · Vitest ·
Playwright · self-hosted via Caddy + Cloudflare Tunnel (zero paid services).

## Requirements

- Node ≥22.22.3, ≥24.15.0, or ≥26.0.0 (see `.nvmrc`; run `nvm use` if you
  manage Node versions with `nvm`). This repo was scaffolded and verified
  against Node 26.5.0.

## Development

```bash
nvm use          # if using nvm — picks up .nvmrc
npm install
npm run start     # dev server at http://localhost:4200
npm test          # Vitest unit tests
npm run lint      # ESLint (angular-eslint)
npm run format    # Prettier --write
npx playwright test   # e2e (once specs exist — see PLAN Phase 4)
```

A pre-commit hook (`simple-git-hooks` + `lint-staged`) runs Prettier and
ESLint on staged files automatically.

## Build

```bash
npm run build
```

Produces a fully static, prerendered site in `dist/typester/browser` — no
Node server required at runtime (see PLAN §D2 for why).

## Deployment

Self-hosted, zero recurring cost: a local Caddy static server, exposed via a
free Cloudflare Tunnel to `typester.ashwinsathian.com`. One-time setup and
subsequent deploys are documented in [ops/README.md](./ops/README.md).

## Project structure

```
src/app/
  core/       singleton services, functional guards, shared models
  features/   home, game, results, settings, help — one folder per route
  shared/     ui/  — presentational design-system primitives
              data/ — bundled word bank
ops/          Caddyfile, cloudflared config, launchd services, deploy script
```
