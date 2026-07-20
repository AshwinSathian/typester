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
GitHub (main)  ──push──▶  Cloudflare Pages build  ──▶  typester.ashwinsathian.com
                           (npm run build -- --configuration production)
```

Cloudflare Pages is Git-connected to this repo: every push to `main` triggers
a build and deploy directly on Cloudflare's edge. No self-hosted origin, no
tunnel, no local process to keep alive.

## Folder structure

```
src/app/
  core/
    guards/     gameConfigGuard, dailyChallengeGuard — validate route params
    models/     GameConfig, Stats, Achievement, DailyChallenge, ChallengeLink, WordPack, ...
    services/   game-engine (pure), daily-challenge (pure), storage, sound,
                word-source, share, share-card, challenge-link
  features/     home, game, results, stats, settings, help, legal —
                one lazy-loaded folder per route
  shared/
    ui/         presentational design-system primitives
    data/       bundled word bank (offline fallback) + themed word packs
e2e/            Playwright specs (flows + axe accessibility)
```

## Routes

```
/                              Home
/play/:mode/:difficulty/:duration   Game — gameConfigGuard validates the triple
/play/daily/:date              Game — dailyChallengeGuard validates the date
/results                       Results — reads a GameResult from router state, not a param
/stats                         Stats
/settings, /help               Settings, Help
/privacy, /terms, /license     Legal pages
```

`mode` is `quick | timed | endless`; for `timed`/`endless`, `difficulty` is
`easy | medium | hard` and `duration` is seconds (`30/60/120`) or, for
`endless`, mistakes-allowed ("lives", `3/5/10`). For `quick`, `difficulty`
is always `mixed` and `duration` is the player's configured Quick Play
duration (15–300s, default 90 — see `isValidGameConfig` in
`core/models/game-config.ts`; this range must stay in sync with the
min/max enforced on the Quick Play field in Settings).

## Data flow: a single round

```
Home (pick mode/difficulty/duration, optionally a word pack)
  → router navigates to /play/:mode/:difficulty/:duration[?pack=id]
  → game-config.guard validates params (invalid → redirect home)
  → Game feature reads route params (signal-based input via withComponentInputBinding)
  → game-engine.ts owns session state (idle → playing → finished) as signals
  → each correct/incorrect/near-miss submission updates score/streak/combo
    signals; SoundService fires a cue
  → on finish, GameResult is written via StorageService (best score/stats/
    achievements/day streak) and the router navigates to /results with the
    result passed via router state
```

Game configuration lives **in the URL**, not in a mutable shared-service
boolean — directly fixing legacy defect #2. `/play/easy/2` is shareable,
bookmarkable, and refresh-safe.

The daily challenge (`/play/daily/:date`) and word packs are variants of
this same flow: the daily challenge always uses a config fixed by
`DAILY_CHALLENGE_CONFIG` and a word list seeded deterministically from the
UTC date (bundled word bank only, never the live fetch) so every player
sees the same words; a word pack, when selected, substitutes a bundled
curated list for the live fetch on Timed/Endless rounds. Results from a
daily challenge write into `Stats.dailyResults`, a separate bucket from the
regular `Stats.bestScores` table.

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
`core/services/sound.service.ts` synthesizes correct/near-miss/incorrect/
combo/time-up cues as short tones. Avoids audio-asset licensing questions
and keeps the bundle small.

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

**D12 — Daily challenge: deterministic per-date seed, bundled words only.**
`core/services/daily-challenge.ts` derives a seed from the UTC calendar
date and feeds it through a seeded PRNG into the same `buildRoundWords`
draw the rest of the app uses — always against the bundled word bank, never
`WordSourceService`'s live fetch. True player-to-player comparability
needs every player drawing from the same fixed candidate pool with the
same shuffle, which a per-round live fetch structurally can't guarantee.

**D13 — Share card: client-side `<canvas>` rasterization, no rendering
service.** `core/services/share-card.service.ts` draws a themed PNG at
share time — no server round-trip, no third-party image API. `ShareService`
remains the plain-text/clipboard fallback for platforms that can't share
files; the two compose in `Results.shareResult()` rather than one replacing
the other.

**D14 — Challenge links and daily-challenge results are self-reported and
unverifiable, and that's an accepted limitation, not a bug to fix later.**
There's no backend (D1's scope holds), so a challenge link's encoded
score/WPM can't be verified server-side. Copy never calls it a
"leaderboard" or "verified" — a client-only trick doesn't get to pretend to
be a server-backed guarantee.

## Testing strategy

- **Unit (Vitest)**: `game-engine.ts` (draw-without-replacement, scoring,
  streak combo, power words, near-miss detection, escalating difficulty,
  every state-machine transition), `daily-challenge.ts`/
  `daily-challenge.service.ts` (deterministic seeding, epoch/date
  validation), `challenge-link.ts` (encode/decode round-trip, rejection of
  malformed params), `game-config.guard.ts`/`game-config.ts` (valid-route
  rules for every mode), `storage.service.ts` (defaults, round-trip,
  corrupted-data fallback, day-streak/freeze bookkeeping), `sound.service.ts`
  (no-throw without `AudioContext`), `share-card.service.ts` (no-throw
  without canvas support), word bank and word pack data integrity
  (uniqueness, character set, length bands per difficulty tier).
- **Component (Vitest + Angular testing utilities)**: typing input
  auto-focus/auto-clear/Enter-to-submit behavior, results screen derived
  numbers from a fixture, settings form persistence, notice banner
  dismiss/persist behavior.
- **E2E (Playwright — Chromium, WebKit, a mobile viewport)**: keyboard-only
  Quick Play run start to finish, Game Modes flow, Endless mode, exit-and-
  resume/discard flow, the daily challenge, challenge links, settings
  persist across a reload, keyboard navigation, the notice banner's
  in-flow (never-covering) behavior, light/dark toggle applies without a
  flash of unstyled content.
- **Accessibility (`@axe-core/playwright`)**: 0 serious/critical violations,
  both themes, across Home (including the challenge-link landing state),
  Help, Settings, Stats, the legal pages, and the daily-challenge Game
  route.

## Known limitations

- **No backend, accounts, or cross-device sync.** All persistence is
  per-browser `localStorage`. Accepted: a database would be a recurring-cost
  and attack-surface liability disproportionate to this app's needs.
- **No live Node server, so no server-side incident surface.** Cloudflare
  Pages serves the prerendered static output directly from the edge —
  nothing to keep alive, patch, or fail over on this end.
- **Bundled word bank is static.** Adding new fallback words requires a code
  change + redeploy, not a CMS — acceptable since it's only the offline
  fallback path, not the primary word source.
- **English only.** The word bank and all copy assume English; no
  internationalization.
- **Results isn't covered by an automated axe scan.** It's reached via
  router state rather than a directly-navigable route, so
  `e2e/accessibility.spec.ts` can't deep-link to it the way it does every
  other screen. It follows the same design-system rules as every other
  screen, just without a dedicated automated check yet.
