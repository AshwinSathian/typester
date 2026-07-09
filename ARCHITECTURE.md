# Architecture: Typester

Typester is a keyboard-first typing speed game: a word appears, you type it,
you race the clock, chasing a streak multiplier and your best score. It's a
ground-up rebuild of a 2018 Angular 7 app — nothing from that codebase
carries forward except the core game idea. Companion doc:
[DESIGN-typester.md](./DESIGN-typester.md) (design tokens, component spec,
screen-by-screen behavior).

## Background — legacy defects this rebuild fixes

The previous implementation (Angular 7, NgModules, Bootstrap 4, TSLint,
Karma, Protractor) had concrete problems each decision below traces back to:

1. `timer.component.ts` manipulated the DOM directly via `getElementById` /
   `setInterval`, entirely outside Angular's reactivity — not testable, not
   reactive.
2. `CommonService` was a mutable bag of booleans (`quickPlay`, `accessGame`,
   `chosenMode`) used to gate navigation to `/game` — a hidden, untyped state
   machine that broke on refresh and couldn't be unit tested cleanly.
3. Exactly 10 hardcoded words per difficulty tier, no variety across
   sessions.
4. `SettingsComponent` built a `FormGroup` and never wired up a submit
   handler that saved anything — the settings screen was decorative.
5. No tests worth carrying forward, no accessibility, no offline support, no
   sound, no PWA manifest.

## System

```
┌─────────────────────────────┐        outbound-only         ┌──────────────────────┐
│  Ashwin's Mac                │ ───────────────────────────▶ │ Cloudflare edge      │
│                              │      (cloudflared tunnel)     │ typester.ashwinsathian│
│  ┌────────────────────────┐  │                               │ .com (TLS terminated)│
│  │ Caddy :8787 (loopback) │◀─┼── cloudflared ingress          └──────────┬───────────┘
│  │ serves dist/.../browser│  │                                            │
│  └────────────────────────┘  │                                            ▼
│  ~/.typester/releases/*     │                                    end user's browser
└──────────────────────────────┘
```

No inbound port is ever opened on the home network — `cloudflared` holds an
outbound connection to Cloudflare's edge, and Caddy only listens on
`localhost`. Setup, deploys, and troubleshooting: [ops/README.md](./ops/README.md).

## Folder structure

```
src/app/
  core/       singleton services, functional guards, shared models
  features/   home, game, results, settings, help, legal — one folder per route
  shared/
    ui/       presentational design-system primitives
    data/     bundled word bank (offline fallback)
e2e/          Playwright specs (flows + axe accessibility)
ops/          Caddyfile, cloudflared config, launchd services, deploy script
```

## Data flow: a single round

```
Home (pick mode/difficulty/duration)
  → router navigates to /play/:mode/:difficulty/:duration
  → game-config.guard validates params (invalid → redirect home)
  → Game feature reads route params (signal-based input via withComponentInputBinding)
  → game-engine.ts owns session state (idle → playing → finished) as signals
  → each correct/incorrect submission updates score/combo signals; SoundService fires a cue
  → on finish, GameResult is written via StorageService (best score/stats) and
    the router navigates to /results with the result passed via router state
```

Game configuration lives **in the URL**, not in a mutable shared-service
boolean — directly fixing legacy defect #2. `/play/easy/2` is shareable,
bookmarkable, and refresh-safe.

## Key decisions

**D1 — Zoneless, standalone, signals-first, no NgRx.**
State management is plain signal-based injectable services under
`core/services` — no `@ngrx/*`. The entire app has one small game session's
worth of state and a settings/stats store, both of which fit comfortably in
a couple of services. Revisit only if a concrete future feature (e.g.
multiplayer) needs more — not currently planned.

**D2 — Static prerendered output, no live Node server.**
`outputMode: "static"` in `angular.json` builds to only
`dist/typester/browser/*` — no `dist/typester/server`, no runtime Express
process. Every screen's HTML is identical for every visitor (no auth, no
per-request personalization), so a live Node process would be pure attack
surface for zero benefit over build-time prerendering.

**D3 — Route-encoded game config over shared mutable service state.**
Fixes legacy defect #2. `GameConfig` (mode, difficulty, duration) is derived
from route params, validated by a functional guard
(`core/guards/game-config.guard.ts`), and consumed via Angular's
signal-based route param binding.

**D4 — Pure, framework-agnostic game engine.**
`core/services/game-engine.ts` has zero Angular imports and is
unit-tested with plain Vitest (no `TestBed`). Fixes legacy defect #1 — the
timer/session state machine lives here as data; `TimerRing` and other
components render it reactively via `computed()` signals, never
`setInterval`/DOM writes.

**D5 — Word source: live Datamuse API fetch per round, bundled fallback.**
`word-source.service.ts` fetches candidate words at the start of every round
from the free, keyless Datamuse API, constrained to each difficulty tier's
length band, de-duped and validated before use. A 2.5s timeout or any
fetch/validation failure falls back to the bundled curated list
(`shared/data/word-bank.ts`, ≥150 words/tier) — this is what keeps the
installed PWA fully playable offline, not a nice-to-have. No API key, quota,
or paid tier is involved on either path.

**D6 — Tailwind CSS v4 + hand-authored OKLCH design tokens, not a UI kit.**
Tailwind is a utility layer, not a visual identity. All actual design
decisions — color, type, spacing, motion — live in
[DESIGN-typester.md](./DESIGN-typester.md) as CSS custom properties consumed
by Tailwind's `@theme`. No Bootstrap/Material/PrimeNG.

**D7 — Synthesized sound via Web Audio API, no shipped audio assets.**
`core/services/sound.service.ts` synthesizes correct/incorrect/combo/
game-over cues as short tones. Avoids audio-asset licensing questions and
keeps the bundle small.

**D8 — `localStorage` via a versioned `StorageService`, not IndexedDB.**
Settings, best scores, and stats are small key-value data. Schema is
versioned so a future shape change can migrate or safely fall back to
defaults rather than throwing. Revisit only if a future feature needs
structured per-round history at scale.

**D9 — Vitest + Playwright + axe-core, not Karma/Protractor.**
Vitest is the Angular CLI 22 default test runner. Playwright covers e2e +
cross-browser (Chromium/WebKit/mobile viewport) + accessibility via
`@axe-core/playwright`.

**D10 — `simple-git-hooks` + `lint-staged`, not Husky.**
Both are dependency-light. Wired as a `pre-commit` hook running Prettier +
ESLint on staged files.

**D11 — Node 26 LTS scoped via `.nvmrc`, global default untouched.**
Angular 22's CLI requires Node ≥22.22.3/≥24.15.0/≥26.0.0. Pinned to this
repo via `.nvmrc` (`nvm use` picks it up) without touching this machine's
global `nvm` default, which other projects still rely on.

## Testing strategy

- **Unit (Vitest)**: `game-engine.ts` (draw-without-replacement, scoring,
  streak combo, WPM/accuracy formulas, every state-machine transition),
  `storage.service.ts` (defaults, round-trip, corrupted-data fallback),
  `sound.service.ts` (no-throw without `AudioContext`), word bank data
  integrity (uniqueness, character set).
- **Component (Vitest + Angular testing utilities)**: typing input
  auto-focus/auto-clear/Enter-to-submit behavior, results screen derived
  numbers from a fixture, settings form persistence.
- **E2E (Playwright — Chromium, WebKit, a mobile viewport)**: keyboard-only
  Quick Play run start to finish, Game Modes flow, settings persist across a
  reload, light/dark toggle applies without a flash of unstyled content.
- **Accessibility (`@axe-core/playwright`)**: 0 serious/critical violations,
  both themes, across public routes.

## Known limitations

- **No backend, accounts, or cross-device sync.** All persistence is
  per-browser `localStorage`. Accepted: a database would be a recurring-cost
  and attack-surface liability disproportionate to this app's needs.
- **Single point of failure.** If the host Mac or home internet is down,
  `typester.ashwinsathian.com` is unreachable. Accepted for a personal
  project with no uptime SLA — see [ops/README.md](./ops/README.md) for
  recovery steps.
- **Bundled word bank is static.** Adding new fallback words requires a code
  change + redeploy, not a CMS — acceptable since it's only the offline
  fallback path, not the primary word source.
- **English only.** The word bank and all copy assume English; no
  internationalization.
