# RFC: Typester — Ground-Up Rebuild on Angular 22

> Status: OPEN FOR REVIEW
> Scale: Epic
> Target start: 2026-07-09
> Created: 2026-07-09

---

## 🎯 Goals

Typester was a word-typing speed game built in Angular 7 (2018) — a word appears,
you type it, you score points against a clock. The concept is good; the
implementation is a decade of Angular history behind. This RFC is a **complete
rebuild**, not a migration: nothing from the old codebase carries forward
except the core game idea.

**Success, concretely, looks like:**

- `https://typester.ashwinsathian.com` serves a fast, installable, offline-capable
  typing game, self-hosted from Ashwin's own machine via a free Cloudflare
  Tunnel.
- The codebase is a **specimen-quality Angular 22 application**: zoneless,
  signals-first, standalone, new control flow, Signal Forms, Vitest — every
  pattern in it is defensible by citing the current official style guide at
  angular.dev, not "how we used to do it."
- The UI/UX reads as deliberately, obsessively designed — typography, motion,
  color, sound, and keyboard-first interaction all considered — see
  [DESIGN-typester.md](./DESIGN-typester.md) for the concrete spec.
- Every non-trivial implementation decision in this document and in the code
  it produces can answer three questions: _is this the most optimal approach
  available, is this the most secure implementation, could this be more
  concise without losing clarity?_ This triad is restated as an explicit
  acceptance criterion on every phase below, not just asserted here.

## 📘 Background

### The legacy app (reference only — read, not reused)

Cloned read-only from `github.com/AshwinSathian/typester` for behavioral
reference. Angular 7, NgModules, Bootstrap 4 + Font Awesome, TSLint, Karma,
Protractor — all now either deprecated or obsolete tooling.

Game concept preserved:

- **Quick Play**: a fixed mix of 4 easy + 4 medium + 2 hard words, 90s.
- **Game Modes**: pick a difficulty (easy/medium/hard → 1/2/3 points/word),
  then a duration (30s/60s/120s).
- Words are drawn without replacement until the list is exhausted or time
  runs out; correct submissions score; a results screen shows score, time
  bonus, and total.

Concrete defects in the legacy implementation this rebuild must **not**
repeat (each maps to a decision in §Architecture):

1. `timer.component.ts` manipulates the DOM directly via `getElementById` /
   `setInterval`, entirely outside Angular's reactivity — not testable, not
   reactive, breaks under zoneless.
2. `CommonService` is a mutable bag of booleans (`quickPlay`, `accessGame`,
   `chosenMode`) used to gate navigation to `/game` — a hidden, un-typed
   state machine that breaks on refresh and can't be unit tested cleanly.
3. Exactly 10 words per difficulty tier, hardcoded, no variety across
   sessions.
4. `SettingsComponent` builds a `FormGroup` and never wires up a submit
   handler that saves anything — the settings screen is decorative.
5. No tests worth carrying forward, no accessibility, no offline support, no
   sound, no PWA manifest.

### Constraints for this rebuild

- **Zero paid services.** No paid APIs, hosting, fonts, icon packs, or CI.
- **Self-hosted** from the user's own Mac, exposed via a free Cloudflare
  Tunnel to a domain already presumed to be on Cloudflare's free plan
  (`ashwinsathian.com`) — see §Open Questions for the one unverified
  assumption here.
- **"Impeccable" design skill was requested but is not available** in this
  environment when this RFC was drafted. This
  is called out explicitly rather than silently substituted: design
  decisions in this RFC and in [DESIGN-typester.md](./DESIGN-typester.md) are
  made using Apple-HIG-level design judgment and a from-scratch custom design
  system (no Bootstrap/Material/PrimeNG), not a named skill's output. If a
  skill by that name becomes available later, the design doc should be
  re-reviewed against it.

## 🔭 Non-Goals

Explicitly out of scope for this rebuild:

- **No backend, no accounts, no cross-device sync or server-side
  leaderboard.** All persistence (settings, best scores, stats) is local to
  the browser (`localStorage`), consistent with "no paid services" (no
  database to host).
- **No native mobile app** (no Capacitor/Cordova wrapper). Ships as an
  installable PWA only.
- **No monetization, ads, or third-party analytics/tracking scripts** — this
  also simplifies the CSP (§Security) and keeps the app installable offline
  without a third-party dependency.
- **No multiplayer or real-time features.**
- **No internationalization** — English only for v1; the word bank and all
  copy assume English.
- **No hosted CI/CD** (no paid GitHub Actions minutes are required; the repo
  relies on local pre-commit gates). If the repo is later pushed to GitHub
  publicly, free Actions minutes could run the same checks — noted as
  optional follow-up, not required.
- **No per-request server-side rendering.** The app is fully static-prerendered
  at build time (see Key Decision D2) — there is deliberately no live Node
  process handling requests in production.

## 🏗 Architecture

### System diagram

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
`localhost`. See `ops/README.md` for the one-time setup and `ops/deploy.sh`
for releases.

### Component inventory

| Component                                                            | New/Modified                       | Notes                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/app/core/models/*`                                              | New (folder scaffolded, files TBD) | `Word`, `Difficulty`, `GameConfig`, `GameResult`, `Settings`, `Stats` types                               |
| `src/app/core/services/game-engine.ts`                               | New                                | Pure TS, zero Angular imports — word draw, scoring, combo multiplier, WPM/accuracy, session state machine |
| `src/app/core/services/word-source.service.ts`                       | New                                | Fetches per-round words from Datamuse (`HttpClient`, timeout+validate), falls back to bundled word bank   |
| `src/app/core/services/storage.service.ts`                           | New                                | Versioned `localStorage` wrapper for settings/stats/best-scores, `storage`-event reconciliation           |
| `src/app/core/services/sound.service.ts`                             | New                                | Web Audio API synthesized SFX, no shipped audio assets                                                    |
| `src/app/core/guards/game-config.guard.ts`                           | New                                | Functional `CanActivateFn` validating `/play/:mode/:difficulty/:duration`                                 |
| `src/app/shared/data/word-bank.ts`                                   | New                                | ~150+ curated words per tier — fallback source, replaces legacy's 10                                      |
| `src/app/shared/ui/*`                                                | New                                | button, segmented-control, stat-badge, timer-ring, toast, dialog                                          |
| `src/app/features/home/*`                                            | New                                | Landing + mode/difficulty picker                                                                          |
| `src/app/features/game/*`                                            | New                                | Core gameplay screen                                                                                      |
| `src/app/features/results/*`                                         | New                                | Post-round summary                                                                                        |
| `src/app/features/settings/*`                                        | New                                | Signal-Forms-backed, persists                                                                             |
| `src/app/features/help/*`                                            | New                                | Static FAQ                                                                                                |
| `angular.json`, `package.json`, `tsconfig*.json`, `eslint.config.js` | Done                               | Workspace scaffold                                                                                        |
| `ops/*`                                                              | Done                               | Caddyfile, cloudflared config template, launchd plists, deploy script, runbook                            |

### Data flow (a single round)

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

This directly replaces defect #2 above: game configuration is **in the URL**,
not in a mutable shared-service boolean. That makes `/play/easy/2` (say)
shareable, bookmarkable, and refresh-safe, and removes the need for the
guard-by-boolean-flag anti-pattern entirely.

### Key decisions

**D1 — Zoneless, standalone, signals-first, no NgRx.**
Angular 22 (confirmed current stable, June 2026 release) makes zoneless
change detection the default for new apps, with `signal()`/`computed()`/
`effect()`/`linkedSignal()` and signal-based inputs/outputs/`model()` stable.
This app uses all of it, plus `inject()` over constructor injection, and the
**2025 file-naming style guide** (`app.ts` not `app.component.ts` — already
the scaffold default). State management is plain signal-based injectable
services — no NgRx/NgRx-Signals. _Alternative considered_: `@ngrx/signals`
for the store — rejected for this scope; the entire app has one small game
session's worth of state and a settings/stats store, both of which fit
comfortably in a couple of services. Revisit only if a concrete future
feature (e.g. multiplayer) needs it — not planned.

**D2 — Static prerendered output, no live Node server.**
Verified empirically: `outputMode: "static"` in `angular.json`
(changed from the CLI's default `"server"`) builds successfully and produces
_only_ `dist/typester/browser/*` — no `dist/typester/server`, no runtime
Express process. The unused `src/server.ts` Express entrypoint, `express`,
and `@types/express` were removed accordingly. _Alternative considered_: keep
the CLI's default SSR output with `@angular/ssr`'s Express server — rejected
because this app has zero per-request personalization (no auth, no user-specific
data at request time), so a live Node process would be pure attack surface
and an extra service to patch/monitor for no runtime benefit. Build-time
prerendering still gives fast first paint on static routes; all gameplay
state is client-only regardless of rendering mode.

**D3 — Route-encoded game config over shared mutable service state.**
Directly fixes legacy defect #2. `GameConfig` (mode, difficulty, duration) is
derived from route params, validated by a functional guard, and consumed via
Angular's signal-based route param binding — no `accessGame`-style flags.

**D4 — Pure, framework-agnostic game engine.**
`game-engine.ts` has zero Angular imports and is unit-testable with plain
Vitest (no `TestBed`). This directly fixes legacy defect #1 (DOM-manipulating
timer) — the timer/session state machine lives here as data, and a thin
Angular wrapper renders it reactively via signals/`effect()`.

**D5 — Word bank: live API per round, bundled curated list as fallback.**
_Superseded 2026-07-09 — see §Open Questions — resolved._ Original decision
(bundle-only, no runtime fetch) is preserved below for history; the shipping
behavior is now: `word-source.service.ts` fetches fresh words from the
free/keyless Datamuse API at the start of every round (more variety than any
fixed bundle could give), constrained to each difficulty tier's length/
frequency band, with the bundled ≥150-word-per-tier curated list
(`shared/data/word-bank.ts`, still built and tested as originally planned)
serving as the fallback when the fetch fails, times out, or the device is
offline. This keeps the original concern (offline-safe, no hard dependency on
a third party staying free/up) fully addressed while adding session-to-session
variety the static-only version couldn't. No API key, quota, or paid tier is
involved on either path.

**D6 — Tailwind CSS v4 (CLI-native) + hand-authored OKLCH design tokens,
not a UI kit.**
`ng new --style tailwind` is a first-class Angular CLI 22 option and was used
for scaffolding. Tailwind is a utility layer, not a visual identity, so it
doesn't fight the "Apple-grade, bespoke" design goal the way Bootstrap/
Material/PrimeNG would. All actual design decisions — color, type, spacing,
motion — live in `DESIGN-typester.md` and are wired in as CSS custom
properties consumed by Tailwind's `@theme`.

**D7 — Synthesized sound via Web Audio API, no shipped audio assets.**
Avoids any question of audio-asset licensing and keeps the bundle small.
Correct/incorrect/combo/game-over cues are short synthesized tones.

**D8 — `localStorage` via a versioned `StorageService`, not IndexedDB.**
Settings, best scores, and stats are small key-value data — `localStorage`
is sufficient and simpler. Schema is versioned so a future shape change can
migrate or safely fall back to defaults rather than throwing. Revisit only if
a future feature needs structured per-round history at scale (flagged as an
open question, not committed to).

**D9 — Vitest + Playwright + axe-core, not Karma/Protractor.**
Karma is dead; Protractor is dead. Vitest is the Angular CLI 22 default test
runner (already scaffolded). Playwright covers e2e + cross-browser
(Chromium/WebKit/mobile viewport) + accessibility via `@axe-core/playwright`.

**D10 — `simple-git-hooks` + `lint-staged`, not Husky.**
Both are tiny, MIT-licensed, and dependency-light — chosen over Husky for
conciseness (fewer transitive deps, simpler config) per the standing "most
concise implementation" mandate. Wired as a `pre-commit` hook running
Prettier + ESLint on staged files; installed and verified working this
session.

**D11 — Node 26 LTS scoped via `.nvmrc`/`nvm`, global default untouched.**
Angular 22's CLI requires Node ≥22.22.3/≥24.15.0/≥26.0.0; the machine's global
`nvm` default is Node 20 (used by other projects in `~/Documents/Personal`).
Node 26.5.0 was installed via `nvm install 26` (additive — doesn't change the
`nvm` default alias) and pinned to this repo via `.nvmrc`, so `nvm use` inside
this directory picks it up without affecting sibling projects.

## 🔀 Alternatives Considered

| Option                                                     | Description                                     | Pros                                         | Cons                                                                                                                | Verdict                                                               |
| ---------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Angular Universal-style SSR (default CLI output)           | Live Node/Express process rendering per request | Slightly better perceived TTFB on cold cache | Extra process to run/patch/monitor on a home machine exposed to the internet; zero personalization to justify it    | Rejected — see D2                                                     |
| NgRx (classic or Signals store)                            | Centralized reducer-based state                 | Battle-tested for large apps, devtools       | Unjustified ceremony for one game session's worth of state                                                          | Rejected — see D1                                                     |
| Bootstrap/Angular Material/PrimeNG                         | Pre-built component/visual kit                  | Fast to assemble                             | Fights the "bespoke, Apple-grade" design mandate; legacy app already used Bootstrap and looked generic              | Rejected — see D6                                                     |
| Host on a free-tier PaaS (Vercel/Netlify/Render free tier) | Managed static hosting                          | No local ops burden                          | Not "hosted on and served from within this machine" as explicitly requested; free tiers carry usage limits/ToS risk | Rejected — user explicitly requires self-hosting via their own domain |
| IndexedDB for all persistence                              | Structured, larger-capacity local storage       | Scales to rich history data                  | Overkill for today's small settings/stats shape; more API surface to get wrong                                      | Rejected for v1 — see D8, revisit if scope grows                      |

## ⚖️ Tradeoffs

- **No server-side personalization or cross-device data** — accepted, because
  the "no paid services / self-hosted" constraint makes a backend + database
  a recurring-cost and attack-surface liability disproportionate to a
  typing-game's needs. Best scores are per-browser, not per-person.
- **Single point of failure**: if the Mac is off or the home internet is
  down, `typester.ashwinsathian.com` is unreachable. Accepted for a personal/
  portfolio project with no uptime SLA — documented in Risks, not mitigated
  with redundant infra (would violate "no paid services").
- **Bundled word bank is static** — adding new words later requires a code
  change + redeploy, not a CMS. Accepted as the concise, secure choice (see D5).

## 😱 Risks

| Risk                                                                                                                   | Likelihood | Impact | Score | Mitigation                                                                                                                                                                                | Owner       |
| ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Home internet/power outage takes the site offline                                                                      | Med        | Med    | 4     | Accepted for a single-instance deployment; `ops/README.md` documents recovery steps; no redundant hosting per constraints                                                                 | Ashwin      |
| Design scope ("Apple-grade") creeps without a dedicated design skill/tool                                              | Med        | Med    | 4     | `DESIGN-typester.md` locks concrete tokens/specs before Phase 3 starts; each screen has a binary AC, not a vibe check                                                                     | Engineering |
| Zoneless/signals ecosystem edge cases with any future third-party lib                                                  | Low        | Med    | 3     | Dependency footprint kept minimal; any new runtime dependency must be verified zoneless-compatible before adding                                                                          | Engineering |
| Word bank curation: duplicates, ambiguous difficulty, inappropriate words                                              | Med        | Low    | 2     | Unit test enforces uniqueness across tiers; manual curation review before Phase 2 exit                                                                                                    | Engineering |
| Low-severity dev-only npm audit findings linger (`@babel/core` sourcemap read, Windows-only `esbuild` dev-server read) | Low        | Low    | 1     | Both are dev-time-only and non-exploitable on this project's macOS/localhost-only dev server; re-run `npm audit` on every Angular minor bump rather than force-downgrade `@angular/build` | Ashwin      |
| `launchd` services silently stop restarting after a macOS/Homebrew upgrade changes binary paths                        | Med        | Med    | 4     | `ops/README.md` documents the exact reinstall steps; consider a cron healthcheck as follow-up (not committed to this RFC)                                                                 | Ashwin      |
| Assumed `ashwinsathian.com` is already on Cloudflare's free plan/nameservers                                           | Low        | High   | 3     | Must be confirmed before Phase 4 ops execution — see Open Questions                                                                                                                       | Ashwin      |

## 🔗 Dependencies

- **Internal**: none — solo, brand-new repository, no other team/service involved.
- **External (runtime)**: `@angular/*` 22.x, `rxjs` 7.8 (Angular's own peer dep, used minimally — signals are primary), Tailwind CSS 4.1.x. All MIT/permissive OSS, no paid tiers.
- **External (dev/build)**: `angular-eslint` 22, `eslint` 10, `prettier` 3.8, `vitest` 4, `@playwright/test`, `@axe-core/playwright`, `simple-git-hooks`, `lint-staged` — all MIT, no paid tiers.
- **Infrastructure**: Homebrew (present), `cloudflared` 2026.5.2 (already installed via Homebrew), Caddy (not yet installed — one-time `brew install caddy`, documented in `ops/README.md`), a Cloudflare-managed DNS zone for `ashwinsathian.com`.
- **Blocked by**: the user must personally run `cloudflared tunnel login` and `tunnel route dns` (credential-bound to their own Cloudflare account — cannot be automated) before Phase 4's hosting milestone can complete.

## 📅 Phases & Milestones

### Phase 1: Foundation & Scaffolding — complete

**Goal**: A buildable, lintable, tested empty shell with all tooling and ops
artifacts in place, so Phase 2 can start with zero setup friction.
**Deliverable**: this repository's current state.
**Tasks**:

- [x] Scaffold Angular 22 workspace (`--zoneless --standalone --style tailwind --ssr --test-runner vitest --ai-config claude`) — AC: `npm run build` succeeds.
- [x] Switch `outputMode` to `static`; delete the unused Express runtime (`src/server.ts`, `express`, `@types/express`) — AC: `dist/typester/` contains only `browser/`, verified via a real build.
- [x] Add `angular-eslint` + Prettier — AC: `npm run lint` and `npm run format:check` execute without configuration errors.
- [x] Add pre-commit quality gate (`simple-git-hooks` + `lint-staged`) — AC: `.git/hooks/pre-commit` exists, invokes `npx lint-staged`, installed and verified.
- [x] Feature-based folder skeleton (`core/{services,guards,models}`, `features/{home,game,results,settings,help}`, `shared/{ui,data}`) — AC: all directories exist with a purpose-documenting `README.md`.
- [x] Playwright + axe-core scaffolding — AC: `playwright.config.ts` present at repo root; browser binaries not yet downloaded (deferred to Phase 4 — no specs exist yet to run).
- [x] Self-hosting ops artifacts — AC: `ops/Caddyfile`, `ops/cloudflared/config.yml.example`, `ops/launchd/*.plist`, `ops/deploy.sh` (executable), `ops/README.md` all present.
- [x] Pin Node 26 via `.nvmrc`/`nvm` without touching the machine's global Node default — AC: `cat .nvmrc` → `26.5.0`; `nvm alias default` unchanged (still 20).
- [x] `npm audit` reviewed; one non-forceable low-severity finding documented rather than silently ignored or blindly force-fixed — AC: see Risks table.
- [x] `.claude/CLAUDE.md` (generated by `--ai-config claude`) extended with this project's specific conventions (route-encoded game config, pure `game-engine.ts`, no NgRx, no UI kit, no runtime word/audio fetch) — AC: file updated, verified present.
      **Exit criteria**: `npm run build`, `npm run lint`, and `npm test` all succeed against the empty shell — verified: lint reports "All files pass linting"; Vitest reports 2/2 tests passing.

### Phase 2: Core Game Engine & Persistence (~3–4d)

**Goal**: All game logic works headlessly and is fully unit-tested before any UI exists — proves the hard part (correctness) independent of the design work in Phase 3.
**Deliverable**: `src/app/core/**` fully implemented.
**Tasks**:

- [ ] Define shared models in `core/models` (`Word`, `Difficulty`, `GameConfig`, `GameResult`, `Settings`, `Stats`) — AC: `tsc` compiles with `strict` on (already enabled); no `any` types.
- [ ] Build curated word bank in `shared/data/word-bank.ts` (≥150 unique words/tier) — AC: unit test asserts uniqueness within and across tiers, and that every word matches `/^[a-z]+$/`.
- [ ] Implement `core/services/game-engine.ts` (pure TS: Fisher-Yates draw-without-replacement, scoring incl. streak combo multiplier and power-word bonus, WPM = `correctChars / 5 / minutesElapsed`, accuracy = `correct / attempts`, `idle → playing → finished` state machine) — AC: Vitest reports ≥90% branch coverage on this file; every state transition has a dedicated test.
- [ ] Implement `core/services/word-source.service.ts` (Datamuse fetch per round, difficulty-band query params, response validation, `AbortController` timeout, fallback to the bundled word bank) — AC: tests cover a successful fetch, a timeout, a malformed response, and an offline/network-error case, all three failure modes falling back correctly.
- [ ] Implement `core/services/storage.service.ts` (versioned `localStorage` wrapper, schema version key, `storage`-event listener reconciling best-scores across tabs) — AC: tests cover fresh-install defaults, round-trip persistence, fallback-to-defaults on corrupted/unparsable stored data, and a simulated cross-tab `storage` event updating in-memory state.
- [ ] Implement `core/services/sound.service.ts` (Web Audio synthesized cues, respects a mute setting) — AC: test verifies no exception is thrown when `AudioContext` is unavailable (true in the jsdom test environment).
- [ ] Implement `core/guards/game-config.guard.ts` (functional `CanActivateFn` validating `/play/:mode/:difficulty/:duration`) — AC: tests cover both a valid and an invalid param combination, confirming the invalid case redirects home.
      **Exit criteria**: `npm test` is green with the above coverage; a reviewer can read `game-engine.ts` and its tests alone and understand the entire game's rules without looking at any UI code.

### Phase 3: Design System & Screens (~5–6d)

**Goal**: Ship the full user-facing experience at the bar set in `DESIGN-typester.md`.
**Deliverable**: Home, Game, Results, Settings, Help screens; shared UI primitives; routing; theming; motion; accessibility.
**Tasks**:

- [ ] Design tokens in `src/styles.css` per `DESIGN-typester.md` §Tokens (OKLCH palette, spacing/type/motion scale, light+dark) wired into Tailwind's `@theme` — AC: both themes render with no hardcoded colors outside the token file.
- [ ] Shared UI primitives (`button`, `segmented-control`, `stat-badge`, `timer-ring`, `toast`, native `<dialog>`-based modal) in `shared/ui` — AC: each is a standalone component using `input()`/`output()` (no decorators), each has a Vitest component test.
- [ ] Home screen incl. mode/difficulty picker — AC: matches `DESIGN-typester.md` §Home; fully keyboard-navigable (Tab/Enter only, no mouse) end to end.
- [ ] Game screen (word prompt, typing field, `timer-ring`, combo/streak feedback, `aria-live` score/timer announcements) — AC: a correct submission advances to the next word with a single Enter keystroke and no click; `@axe-core/playwright` reports 0 serious violations.
- [ ] Results screen incl. achievement badges and a Share action (`ShareService`: `navigator.share` where available, clipboard-copy + `Toast` fallback otherwise) — AC: given a fixture `GameResult`, score/WPM/accuracy/best-score-delta and unlocked achievements all render the mathematically correct values (component test, not a snapshot); share action is exercised in a Playwright test with the Web Share API mocked out.
- [ ] SEO/meta pass on prerendered public routes (Home, Help, Settings, legal pages): per-route `<title>`/meta description via Angular's `Title`/`Meta` services, Open Graph + Twitter Card tags, one `WebApplication` JSON-LD block, `public/robots.txt`, generated `public/sitemap.xml` — AC: `curl` against the prerendered static output shows real tags (not the CLI default placeholder title) on every public route.
- [ ] Settings screen using Signal Forms (`@angular/forms/signals`) — AC: every field change persists via `StorageService` and survives a full page reload (Playwright test).
- [ ] Help/FAQ screen — AC: static content renders; passes axe.
- [ ] Routing: lazy-loaded features via `loadComponent`, `withViewTransitions()` enabled on the router — AC: navigating between routes triggers a View Transition unless `prefers-reduced-motion: reduce` is set, in which case it's instant.
      **Exit criteria**: Quick Play and Game Modes are playable start-to-finish in a real browser; Lighthouse Accessibility score = 100 on every screen.

### Phase 4: PWA, Hardening & Launch (~3–4d)

**Goal**: Ship-ready, installable, fully tested, live at `typester.ashwinsathian.com`.
**Tasks**:

- [ ] `ng add @angular/pwa` — AC: manifest + service worker generated; app is installable in a Chromium browser.
- [ ] Custom app icons (not the Angular default) — AC: 192px, 512px, and a maskable icon variant present in `public/`.
- [ ] Full Playwright e2e suite (see Testing Strategy) — AC: all specs green across `chromium`, `webkit`, and a mobile viewport project.
- [ ] Axe accessibility suite across all screens, both themes — AC: 0 serious/critical violations.
- [ ] Lighthouse pass on the production build — AC: Performance/Best Practices/SEO ≥95, Accessibility = 100.
- [ ] Verify CSP/security headers against the real served output — AC: `curl -I http://localhost:8787` (Caddy) shows every header defined in `ops/Caddyfile`.
- [ ] User completes the one-time hosting setup per `ops/README.md` (Caddy install, `cloudflared tunnel login`/`create`/`route dns`, launchd install) — AC: `https://typester.ashwinsathian.com` resolves over HTTPS and serves the app.
- [ ] `ops/deploy.sh` dry-run — AC: produces a new timestamped release under `~/.typester/releases` and flips the `current` symlink without downtime.
      **Exit criteria**: App is live at the target domain, installable, and every automated check above is green.

## 🧪 Testing Strategy

- **Unit tests (Vitest)**: `game-engine.ts` (draw-without-replacement never repeats until exhausted; scoring per tier; WPM/accuracy formulas; every state-machine transition), `storage.service.ts` (defaults, round-trip, corrupted-data fallback), `sound.service.ts` (no-throw without `AudioContext`), word bank data integrity (uniqueness, character set).
- **Component tests (Vitest + Angular testing utilities)**: typing input auto-focus/auto-clear/Enter-to-submit behavior; results screen renders correct derived numbers from a fixture; settings form calls `StorageService` on every field change.
- **E2E (Playwright, `chromium` + `webkit` + a mobile viewport)**: keyboard-only Quick Play run start to finish; Game Modes flow (difficulty → duration → play → results → menu); settings persist across a reload; light/dark toggle applies without a flash of unstyled content.
- **Accessibility (`@axe-core/playwright`)**: 0 serious/critical violations on Home, Game, Results, Settings, Help, in both themes.
- **Performance**: manual `npx lighthouse` run against the production static build pre-launch; target thresholds stated in Phase 4.
- **Regression**: N/A yet (brand-new repo) — from Phase 2 onward, every phase's exit criteria include "all previous phases' tests still green."

## ⚙️ Operations

- **Observability**: no paid tooling. Caddy's access log rotates locally (`ops/Caddyfile`, `log` block, 10MB × 5 files); Cloudflare's free dashboard gives basic edge-level traffic visibility.
- **Alerts**: none automated (would require a paid/third-party uptime service). Follow-up candidate, not committed: a local cron job curling the public URL and emailing/notifying on failure.
- **Runbook**: `ops/README.md` — one-time setup, subsequent deploys (`ops/deploy.sh`), and rollback (re-point the `current` symlink to a prior timestamped release, no rebuild needed).
- **On-call implications**: none — single-instance deployment, no SLA.

## ❓ Open Questions — resolved 2026-07-09

All five questions below were open at end of Phase 1. Decisions, made 2026-07-09:

- **Cloudflare zone**: confirmed via `cloudflared tunnel list`/`cert.pem` on this
  machine — the account already holds active tunnels against
  `ashwinsathian.com` for other projects, so the zone is live on Cloudflare.
  Phase 4 adds a new `typester` tunnel + DNS route alongside them.
- **Word source — live API with curated fallback, not purely bundled** (revises D5
  below). Each round fetches candidate words at start from the **Datamuse
  API** (`api.datamuse.com`) — free, keyless, CORS-enabled, no auth/quota wall
  to manage. `core/services/word-source.service.ts` requests words per
  difficulty tier (constrained by length + `md=f` frequency metadata so
  common-word tiers stay easy), de-dupes, and validates the response before
  handing a plain `string[]` to the pure `game-engine.ts`. A 2.5s
  `AbortController` timeout plus any fetch/validation failure falls back to
  the bundled `shared/data/word-bank.ts` curated list — this is what keeps the
  installed PWA fully playable offline, not a nice-to-have.
- **Stats granularity — per mode+difficulty+duration combination**, not one
  global high score. More combinations to beat is more game-like and costs
  little extra schema (`Record<string, BestScore>` keyed by config).
- **Share affordance — in scope for v1.** Web Share API (`navigator.share`)
  where available, clipboard-copy fallback otherwise. Composes a short result
  string (score/WPM/mode) plus the app's own URL — no image generation, no
  external image-rendering service.
- **Multi-tab reconciliation — handled.** `StorageService` listens for the
  `storage` window event and re-reads/merges best-scores so a second tab's
  win isn't silently overwritten; last-write-wins for settings (acceptable —
  settings aren't append-only data, unlike best scores).

Additional decisions made in this pass (user-directed):

- **More "game-like" scoring** (user-directed): streak-based combo
  multiplier (every 5-correct streak bumps a score multiplier, capped),
  occasional "power word" bonus-multiplier words, and a lightweight
  achievement/badge set surfaced on Results — see DESIGN §Gamification.
- **SSR reconsidered and re-confirmed as out of scope** (user asked for a
  critical re-evaluation, not a default answer): the app has zero
  per-request personalization — every screen's HTML is identical for every
  visitor. Build-time prerendering (D2, unchanged) already gives crawlers
  and first paint the full static HTML for Home/Help/Settings/legal routes;
  a live `@angular/ssr` Express process would add a process to patch/monitor
  for zero marginal SEO/perf benefit over prerendering, and would be the
  single largest new piece of attack surface in the whole stack. Decision:
  keep static-only output, and close the SEO gap this doc previously left
  open with real `<meta>`/Open Graph/`sitemap.xml`/`robots.txt`/JSON-LD work
  in Phase 3 (a prerendering-compatible, zero-server way to get the same
  outcome) — see D2 addendum and Phase 3 tasks.

## Note on live word source vs. "no third-party services"

The RFC's Non-Goals still hold — no backend _we operate_, no accounts, no
analytics/tracking scripts. The Datamuse API is a read-only, keyless, public
GET endpoint the client calls directly (like a font CDN would be, except it
isn't one — no persistent connection, no cookies, no tracking parameters).
Because Phase 1 explicitly rejected a _shipped_ runtime word/audio dependency
(D5/D7) purely to preserve offline play, and this decision reinstates a live
fetch, the offline guarantee now depends entirely on the fallback path
actually working — this is why the fallback isn't optional and is covered by
its own Playwright test (network offline → round still completable).

## 🗂 Appendix

- Legacy repo (reference only): `github.com/AshwinSathian/typester`, cloned read-only for behavioral reference.
- Angular 22 confirmed as current stable (June 2026) with zoneless-by-default, stable Signal Forms, and Vitest as the default test runner — verified via live research at the time this RFC was written, not assumed from training data.
- Companion document: [DESIGN-typester.md](./DESIGN-typester.md) — full design-system spec (tokens, component inventory, screen-by-screen behavior, motion, sound, accessibility checklist).
- Companion runbook: [ops/README.md](./ops/README.md) — self-hosting setup.
