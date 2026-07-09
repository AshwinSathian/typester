# RFC: Typester — Growth & Retention Rebuild

> Status: OPEN FOR REVIEW
> Scale: Epic (Phases 5–9, follows on from `PLAN-typester.md` Phases 1–4)
> Created: 2026-07-09
> Companion to: [PLAN-typester.md](./PLAN-typester.md) (architecture baseline —
> unchanged unless explicitly noted below), [DESIGN-typester.md](./DESIGN-typester.md)
> (design system baseline), [DESIGN-typester-growth.md](./DESIGN-typester-growth.md)
> (new screens/interaction specs this RFC requires).

## 🎯 Goals

Typester (Phases 1–4) shipped a genuinely well-engineered typing-speed game: a
pure, well-tested game engine, real accessibility rigor, a disciplined token
system, and a small but legitimate set of variable-reward mechanics (streak
combo multiplier, power words). None of that is in question here.

What it does not have is any reason for someone to come back tomorrow, or to
tell a friend about it today. This RFC's goal is to close that gap as far as
it can be closed **without silently abandoning the zero-backend,
self-hosted-from-one-Mac constraint** that Phases 1–4 were built around — and
to be explicit about the handful of places where that constraint puts a hard
ceiling on how far "genuinely popular" can go, rather than pretending a
client-only trick solves a problem that structurally needs a server.

This RFC was produced by consolidating three independent research passes
(behavioral/retention psychology, UI/UX audit, product strategy) run against
the current Phase 1–4 codebase. Where the three agreed, that's a strong
signal and is weighted accordingly below. Where they disagreed or one flagged
something the others didn't, both views are kept rather than smoothed over.

**Success, concretely, looks like:**

- Every data structure Typester already persists (`Stats.achievementsUnlocked`,
  `Stats.dayStreak`, `Stats.bestScores`) has a UI surface a player can
  actually see, not just a value it computes and immediately discards.
- Sharing a result produces something a recipient would actually stop and
  look at, and clicking it lands them in a state that's meaningfully
  different from a cold Home visit.
- There is a reason to open the app *on a given day specifically*, not just
  "whenever."
- The one architectural tension this RFC cannot resolve on its own — genuine
  cross-player comparison requires at least a trivial stateless
  backend, which conflicts with `PLAN-typester.md`'s Non-Goals — is written
  down as an explicit decision for the project owner, not quietly decided
  either way.

## 📘 Executive Diagnosis

Blunt, in one place, so it doesn't get lost in the phase-by-phase detail
below. This is the synthesis of all three research passes, not the
diplomatic average of them.

1. **The engine and accessibility work are the real product here, and they're
   good.** Sub-150ms multi-channel feedback, a real risk/reward streak
   multiplier, true variable-ratio power words, WCAG-rigorous focus/contrast/
   motion handling. Say this once, clearly, and then stop repeating it —
   everything below is about the much larger set of things that are *not*
   at this bar yet.
2. **Achievements are the single clearest failure in the whole app, and all
   three research passes found it independently without being told to look
   for it.** `Stats.achievementsUnlocked` and `ACHIEVEMENTS` exist, are
   computed correctly, and are then shown for one Results screen and never
   again. There is no route, no panel, nowhere in `Help` — despite
   `DESIGN-typester.md` explicitly calling for one. This is built
   infrastructure whose entire retention purpose was never wired up. Fix
   this before anything else in this RFC; it's the highest ROI-per-hour
   finding across all three reports.
3. **A "speed game" with no live WPM during play is hard to defend.** Score
   and streak update live; WPM — the number every player of this genre
   actually tracks second-to-second in Monkeytype, TypeRacer, and
   10fastfingers — only appears after the round ends. The math already
   exists in `game-engine.ts` for the Results screen; this is a wiring gap.
4. **Sharing is currently a dead end, and the per-round word source makes it
   worse than "just weak."** The share string is plain text with no visual
   artifact and a URL that's just the homepage. Separately: because
   `word-source.service.ts` fetches fresh Datamuse words every round, two
   people playing the "same" config get *different words* — so there is
   structurally no such thing as an apples-to-apples comparison today, even
   informally. Fixing the share artifact without fixing this underlying
   comparability problem would just make a nicer-looking dead end.
5. **There is no reason to open the app today versus any other day.** A day
   streak is tracked and rendered, but nothing about the content or the
   score is dated or shared-context — no equivalent of Wordle's "#1043."
   The streak counter currently measures private consistency, not anything
   a returning player could talk about with someone else.
6. **The one differentiated, already-shippable asset is under-leveraged:**
   `GameConfig` is already route-encoded (`/play/:mode/:difficulty/:duration`,
   PLAN D3). That is exactly the substrate a "beat this score" challenge
   link needs, and nothing currently uses it for that.
7. **Visual identity does not earn `PLAN-typester.md`'s "obsessively
   designed" claim.** Indigo accent + Inter + JetBrains Mono + dot-grid is
   a competent but generic "developer tool" look, confirmed by direct
   screenshot comparison against Wordle/Monkeytype/Duolingo, none of which
   Typester currently has an equivalent visual anchor to. The claim is
   earned by the accessibility/token engineering, not by the visuals.
8. **A real, unglamorous bug was found along the way and should not wait for
   any of the above**: in `game.ts`'s `onSubmit()`, the input field is only
   cleared on a correct submission. An incorrect guess leaves stray
   characters in the field, forcing a manual clear before retrying — inside
   the exact interaction the whole design philosophy calls frictionless,
   and landing at the exact moment (right after a streak reset) where it
   reads worst.
9. **The zero-backend constraint is not free, and this RFC will not pretend
   otherwise.** Real leaderboards, cross-device identity, a friend graph,
   and push notifications all structurally require at least a minimal
   server. Every recommendation in Phases 5–8 below is deliberately chosen
   to be achievable without one — but the ceiling that leaves in place is
   real, and Phase 9 names it explicitly rather than working around it with
   something that looks client-only but doesn't actually work (Periodic
   Background Sync, unverifiable client-side "leaderboards," etc.).

## 🔭 Non-Goals (of this RFC specifically)

- **Does not modify `PLAN-typester.md`'s Non-Goals by default.** No backend,
  no accounts, no monetization, no real-time multiplayer — all still hold
  through Phase 8. Phase 9 is the one place this RFC asks the project owner
  to make an explicit go/no-go call on relaxing exactly one of them (a
  minimal stateless leaderboard backend) — see §Phase 9.
- **Not a redesign of the core typing loop's rules.** Scoring, the streak
  multiplier, power words, and difficulty tiers are not being replaced —
  Phase 8 extends them (escalating in-round difficulty, near-miss feedback),
  it doesn't rework the point values or tier structure decided in Phase 2.
- **Not a rebrand.** "Typester" as a name is assessed as neutral, not broken
  (see product research) — this RFC recommends sub-branding the daily mode
  ("Typester Daily") as free real estate within the share artifact, not
  renaming the app.
- **No code in this pass.** This document and its companion design addendum
  are the entire deliverable of this research/planning effort. Implementation
  of any phase below should go through its own focused planning pass
  (`/plan-engineering` or equivalent) when the project owner decides to build
  it — this RFC is intentionally not itself an implementation plan with
  file-by-file diffs.

## 🏗 Architecture Additions

New shape required, layered onto the existing Phase 1–4 architecture (see
`PLAN-typester.md` §Architecture for the baseline this extends). Nothing here
requires a backend, a new npm dependency category, or a change to the
zoneless/signals-first/no-NgRx conventions.

| Addition | Layer | Notes |
|---|---|---|
| `core/models/daily-challenge.ts` | model | `{ date: string (YYYY-MM-DD, UTC), seed: number, config: GameConfig }` |
| `core/services/daily-challenge.service.ts` | service | Pure-ish wrapper around a deterministic seed derived from the UTC date, feeding the existing injectable `rng` parameter already accepted by `buildRoundWords()` in `game-engine.ts` — this is a drop-in extension point, not new engine architecture. Zero Angular imports in the seeding function itself (belongs beside `game-engine.ts`, per PLAN D4) |
| `core/services/share-card.service.ts` | service | Client-side `<canvas>` rasterization of a shareable PNG (score, WPM, streak/combo visual, daily challenge number where applicable). Uses `navigator.canShare({ files })` where supported, falls back to the existing text+clipboard path in `share.service.ts` otherwise. No server-side rendering, no third-party image API — consistent with PLAN's rejection of a *service* dependency, not of client-side canvas use |
| `shared/data/word-packs/*.ts` | data | 4–6 themed word banks (Movies & TV, Tech/Programming, Science, Everyday), authored the same way as the existing `shared/data/word-bank.ts` — bundled, no runtime fetch dependency beyond the existing Datamuse fallback pattern |
| Route `/play/daily/:date` | routing | Validated by an extension of the existing functional `game-config.guard.ts` (date format + not-in-the-future check) |
| Route `/stats` (or `/progress`) | routing | New lazy-loaded feature, reads `StorageService` directly (already a public signal per existing `home.ts` usage) — no new service needed beyond what's already stored |
| `Stats` model extension | model | Bounded round-history ring buffer (last ~50 rounds — small enough for `localStorage`, this is exactly the case PLAN D8 flagged as "revisit if a future feature needs structured history at scale"), streak-freeze token count, tiered-achievement progress fields |
| `game-engine.ts` extensions | engine | (a) near-miss (edit-distance-1) check alongside the existing exact-match check; (b) word-selection weighting toward longer/rarer words as streak climbs (extends `buildRoundWords`, resets on miss); (c) a survival/endless end-condition (round ends on Nth mistake instead of/in addition to a clock). All engine-only, all unit-testable headlessly per PLAN D4 — **do not** let any of this logic leak into `game.ts`, where it stops being unit-testable without `TestBed` |
| `game.ts` / Game screen | component | Live WPM `computed()` off the existing 100ms tick interval (reuse `TICK_INTERVAL_MS`, don't add a second timer); word look-ahead queue rendering; near-miss visual state |

## 📅 Phases & Milestones

### Phase 5: Fix & Ground Truth (~1–2d)

**Goal**: Everything already built actually works and is visible, before any
new mechanic is layered on top of it. No new user-facing feature — pure
completion of Phase 1–4's own unfinished promises.

**Tasks**:

- [ ] Fix the incorrect-submission input-clear bug in `game.ts` `onSubmit()`
  — AC: an incorrect submission clears (or selects-all) the input field
  identically to the correct path; a Playwright test types a wrong word
  twice in a row without manually clearing between attempts.
- [ ] Fix the mobile `NoticeBanner` permanent layout reservation — AC:
  `main#main-content`'s `padding-bottom: 10rem` reservation is removed once
  the banner is a dismiss-once toast/sheet rather than a permanent fixed
  bottom bar; verified via a 390×844 viewport screenshot showing the Game
  screen's interactive cluster no longer competing for space with a banner
  that's already been dismissed.
- [ ] Add a live, continuously-updating WPM `StatBadge` to the Game screen
  — AC: WPM value updates at least once per second during an active round,
  matching the same formula already used on Results (`game-engine.ts`); a
  component test asserts the live value converges to the Results-screen
  value at round end.
- [ ] Add a near-miss feedback tier (edit-distance-1 typos get a distinct
  `--color-warning` treatment, not full `--color-danger`) — AC: a
  single-character typo and a completely wrong word visibly differ in
  color/shake amplitude; unit test on the edit-distance-1 classification in
  `game-engine.ts`.

**Exit criteria**: all Phase 1–4 tests still green; the four items above each
have a dedicated new test; no regression in Lighthouse Accessibility (still
100).

### Phase 6: Daily Challenge & Shareable Artifact (~4–5d)

**Goal**: give Typester a dated, comparable, actually-shareable artifact —
the single highest-leverage tier identified across all three research
passes. This phase is the direct answer to Executive Diagnosis #4, #5, #6.

**Tasks**:

- [ ] Implement `daily-challenge.service.ts`: derive a deterministic seed
  from the UTC date, feed it into `buildRoundWords()`'s existing `rng`
  parameter to produce one fixed word list/order every player gets that
  day — AC: two independent calls with the same date produce byte-identical
  word lists; a call with tomorrow's date produces a different list;
  unit-tested without any Angular/DOM dependency.
- [ ] Add `/play/daily/:date` route + Home CTA ("Today's Challenge") — AC:
  the guard rejects a malformed or future-dated `:date` param and redirects
  home, mirroring the existing `game-config.guard.ts` pattern.
- [ ] Give the daily result its **own** storage key, separate from
  `bestScores` — AC: a daily-challenge result never writes into the same
  bucket a manually-picked config does (this is a named risk from the
  retention research — a daily challenge that scores into the same bucket
  as a normal round has no distinct collectible identity and won't do the
  ritual-forming work it's meant to).
- [ ] Build `share-card.service.ts`: client-side canvas rendering of a
  branded result image (score, WPM, accuracy, streak visual, and the daily
  challenge number when applicable, styled off the existing design tokens)
  — AC: `navigator.canShare({ files })` path is exercised where supported;
  falls back to the existing text+clipboard path where it isn't; a
  Playwright test captures the generated canvas output against a fixture
  `GameResult` for a pixel-diff-tolerant visual check.
- [ ] Encode an arbitrary (non-daily) `GameConfig` + `targetScore` into a
  shareable challenge-link URL — AC: opening that URL on a fresh session
  shows a distinct Home state ("Ashwin scored 412 pts on Hard/60s — beat
  it?") instead of the generic hero, with a one-tap start into that exact
  config.
- [ ] Sub-brand the daily mode as "**Typester Daily**" in copy/share text —
  AC: share strings and the Home CTA use this sub-brand consistently.

**Exit criteria**: a Playwright e2e test plays the daily challenge on two
separate simulated sessions on the same date and confirms identical word
order; the challenge-link flow is exercised end-to-end (share → open fresh
→ land on challenge state → play → compare).

**Explicit risk to carry forward, not solve here**: every score shared this
way is self-reported and trivially forgeable by editing the URL (no
backend to verify it). This is an acceptable limitation for a self-hosted
hobby project and should **never** be presented in-product as "verified" or
a "leaderboard" — that would set an expectation the architecture can't back,
and erode trust the moment anyone notices (flagged independently by the
retention research).

### Phase 7: Progression Surfaces (~3–4d)

**Goal**: every stat Typester already persists gets a place a returning
player can actually go look at it. Directly answers Executive Diagnosis #2.

**Tasks**:

- [ ] Build a `/stats` screen: day streak (with an "at risk" banner when
  `lastPlayedDate` is yesterday and today's round hasn't happened yet,
  replacing the passive chip), rounds played, total words typed, the full
  best-scores grid across all 10 mode/difficulty/duration combos (cross-
  promoting the ones not yet attempted/beaten), and the full achievement
  set rendered earned-vs-locked with a visible counter ("3/5 unlocked") —
  AC: reachable from Home without playing a round; passes axe with 0
  serious/critical violations; a component test confirms locked
  achievements render distinctly (not just "already there but grey").
- [ ] Add one streak-freeze token, earned every 7-day streak, that forgives
  exactly one missed day — AC: unit test confirms a freeze is consumed (not
  silently ignored, not infinitely available) on exactly one gap, and the
  freeze count is visible on the new Stats screen. **Must be scarce and
  earned** — an unlimited or free freeze removes the loss aversion entirely
  and the streak stops functioning as a hook (named risk, retention
  research).
- [ ] Rework Results-screen hierarchy: "Total" rendered at 1.5–2× the visual
  weight of the other four `StatBadge`s and accent-colored; achievement
  chips restyled with a celebratory treatment (accent-filled background,
  small icon, distinct entrance animation) instead of the current
  muted/disabled-tag look — AC: screenshot comparison shows clear visual
  hierarchy; an unlocked-achievement chip and a locked one on the new Stats
  screen are visually distinguishable at a glance.
- [ ] On Results, cross-promote the next unbeaten config in the 10-combo
  set ("New best on Easy/60s — try Easy/120s?") as a secondary action next
  to Play Again/Share/Menu — AC: the suggested next config is never one
  already at its best score for the current streak of plays.
- [ ] Extend the fixed 5-achievement set to tiered versions where it makes
  sense (WPM Club at 30/50/70/90/110; streak milestones at 7/30/100 days)
  — AC: all tiers computable from data already in `Stats`, no new tracked
  field beyond what Phase 7's history/streak work already added.

**Exit criteria**: a returning player with zero rounds played today can open
`/stats` and see a complete, legible picture of their progress and what's
left to unlock, without starting a round.

### Phase 8: Game Feel & Content Depth (~5–6d)

**Goal**: close the gap with the genre's depth leaders (Monkeytype,
TypeRacer) on the mechanics that make a single session feel better, and give
players a reason a session next week doesn't feel identical to one today.

**Tasks**:

- [ ] Word look-ahead queue: current word emphasized, next 2–3 words shown
  visually receded (smaller, muted, lower opacity), advancing as each word
  resolves — AC: verified via screenshot at both mobile and desktop
  viewports; `prefers-reduced-motion` skips the slide animation and swaps
  content directly (duration tokens already collapse to 0ms app-wide).
- [ ] Escalating in-round difficulty: word-selection weight shifts toward
  longer/rarer words as streak climbs, resets on a miss — AC: unit-tested
  in `game-engine.ts` (PLAN D4 — engine-only, zero Angular imports), not in
  `game.ts`.
- [ ] Ship 4–6 themed word packs (Movies & TV, Tech/Programming, Science,
  Everyday) as an additional mode-selection axis — AC: unit test enforces
  the same uniqueness/character-set rules as the existing word bank
  (PLAN Phase 2 AC), extended per-pack.
- [ ] Add an Endless/Survival mode: round ends on the Nth mistake instead of
  a fixed clock, difficulty escalates continuously — AC: new engine
  end-condition unit-tested independent of the existing timer-based state
  machine; does not regress existing timed-mode tests.
- [ ] Give dark mode a distinct personality (e.g. a faint scanline/CRT
  texture replacing light mode's dot-grid, using the same background-image
  token mechanism) rather than a pure lightness inversion — AC: screenshot
  comparison shows a genuinely distinct dark-mode identity, not just
  inverted tokens; contrast requirements (§DESIGN Tokens) still hold.
- [ ] Design and ship a small (6–8 icon) custom icon set in a
  caret/cursor-accented stroke style, replacing the generic line icons
  currently used for Theme/Motion/Exit — AC: drop-in replacement, same
  `viewBox`/`stroke-width` conventions, axe-clean.
- [ ] Home hero: replace the static title/tagline with a short auto-typing
  preview loop (reusing the existing `.home__caret` blink keyframe and word
  bank samples) — AC: frozen on the first frame under
  `prefers-reduced-motion`; a first-time visitor sees the mechanic before
  committing to a click.

**Exit criteria**: Lighthouse Accessibility remains 100 on every new/changed
screen; a full Playwright pass (existing + new specs) is green across
chromium/webkit/mobile viewport projects.

### Phase 9 (Gated — requires an explicit decision from the project owner): Comparative Layer

**Goal**: name, size, and gate the one class of mechanic every research pass
agreed is the single strongest lever in this genre — and that none of Phases
5–8 can deliver honestly, because it structurally requires relaxing
`PLAN-typester.md`'s Non-Goals.

**This phase does not start by default.** It exists so the tension is
written down rather than either ignored or silently acted on.

**The tension, stated plainly** (product research, §The Central Tension):
typing speed is an inherently comparative stat — nobody's WPM means anything
in isolation — and every mechanic that lets a player compare against a real
other human (a global leaderboard, cross-device identity, a friend graph,
push-notification reminders) needs at least a minimal always-on,
Ashwin-operated server. `PLAN-typester.md`'s Non-Goals reject this
explicitly ("no backend, no accounts... no server-side leaderboard... no
multiplayer") for reasons that were correct for a solo portfolio project with
no operating budget or team — attack surface and ongoing maintenance burden,
not just cost (a $0/mo Cloudflare Worker + KV/D1 free tier would satisfy
"zero paid services" but is still unambiguously a backend by the RFC's own
framing).

**Two honest paths, not a recommendation between them** (this is the
project owner's call, per the instruction that this report should surface
the tradeoff, not resolve it):

- **Path A — stay client-only.** Phases 5–8 are the ceiling. Typester
  remains "specimen-quality, zero ops burden," and retention/virality is
  driven entirely by the daily-challenge/share-card/progression mechanics
  above, plus the bounded, honest local mitigations already in scope
  (device-to-device manual score comparison via an encoded/QR-shared
  string — asynchronous, manual, explicitly sized as "a poor-man's
  leaderboard, not a real one," not something to build further than that).
- **Path B — stand up a minimal, narrowly-scoped stateless backend**
  (a single Cloudflare Worker + KV or D1, free tier) **for score
  submission and a real leaderboard only** — not accounts, not a friend
  graph, not push notifications, not real-time multiplayer. This is the
  smallest possible relaxation of the Non-Goals that unlocks the genre's
  strongest engagement lever, and should be scoped that narrowly if chosen,
  not treated as a foot in the door for a larger backend.

**Not recommended at any point without Path B first proving out**: true
live multiplayer racing (needs a realtime relay — WebSocket/WebRTC
signaling — the single highest engineering cost identified across all
research, and the single most differentiating mechanic against Wordle-style
competitors). Sequence after Path B if ever, not before.

## ⚖️ Tradeoffs

- **Every mechanic in Phases 5–8 is real and gets Typester most of the way
  to "harder to ignore than the average side project" without touching the
  Non-Goals** — but the ceiling is lower than it would be with even a
  minimal backend, because the genre's single strongest lever (comparison
  against real other humans) stays structurally unavailable. Whether that
  ceiling is acceptable depends on what "genuinely popular" is actually
  meant to mean — a project a modest circle of friends/portfolio-viewers
  keep coming back to (Phases 5–8 are sufficient, arguably ideal — keeps
  the zero-ops-burden property the original RFC values) versus competing
  for strangers' daily attention against Wordle and Monkeytype at real
  scale (Phase 9 Path B is close to necessary, and even then success isn't
  guaranteed against entrenched incumbents).
- **Self-reported, unverifiable scores in the Phase 6 challenge-link
  mechanic are an accepted limitation, not a bug to eventually fix** within
  Path A — fixing it *is* Phase 9 Path B. Don't let Phase 6 quietly grow a
  "verification" feature; that's scope creep into Phase 9 without the
  explicit decision Phase 9 exists to force.
- **Themed word packs and endless mode (Phase 8) add ongoing content-
  authoring burden** (curating new packs is manual, same as the original
  word bank) — accepted the same way PLAN-typester.md accepted this for
  the original bank ("adding new words later requires a code change +
  redeploy, not a CMS").

## 😱 Risks / Anti-Patterns to Avoid

Consolidated from all three research passes — read before implementing any
phase above, not just as a retrospective checklist.

| Risk | Mitigation | Source |
|---|---|---|
| Achievements/streak-freeze get a points value and start inflating the score ladder | Keep them strictly status-only, decoupled from `bestScores` — same principle `DESIGN-typester.md` already committed to for the original 5 achievements | Retention research |
| Streak-freeze shipped as unlimited/automatic | Must be scarce and earned (one per 7-day streak) — an unlimited freeze removes the loss aversion the mechanic exists to create | Retention research |
| Daily challenge scores into the same bucket as a manually-picked config | Give it its own storage key from day one (Phase 6 task) — otherwise it has no distinct collectible/shareable identity | Retention research |
| A Phase 6 challenge-link score gets presented in-product as "verified" or a "leaderboard" | Never — it's self-reported and forgeable without Phase 9. Say so in the UI copy, don't hide it | Retention + Product research |
| Chasing Periodic Background Sync / Notification API as a "client-only push" substitute | Don't — Chrome/Android-only, off by default, no iOS support; would create a false sense that re-engagement is "handled" when it structurally isn't. State the Phase 9 tradeoff honestly instead | Retention research |
| Home screen accumulates too many new entry points (Stats link, Daily Challenge CTA, next-combo suggestion) and creates choice-paralysis for first-time visitors | Put new entry points where a *returning* player looks (post-Results, a secondary Home area) rather than stacking them next to the primary Quick Play CTA that currently works well for first-time activation | Retention research |
| Word-weighting/near-miss/survival-mode logic leaks into `game.ts` instead of `game-engine.ts` | All engine-only logic stays in the pure, zero-Angular-import engine per PLAN D4 — this is what keeps it unit-testable without `TestBed` | PLAN D4 (restated) |
| Phase 9 Path B, if chosen, scope-creeps into accounts/friend-graphs/push | Scope it to score submission + leaderboard read/write only, explicitly, on approval — anything more is a new RFC, not an extension of this one | Product research |

## 🧪 Testing Strategy Additions

- **Unit tests (Vitest)**: daily-challenge seed determinism (same date →
  identical word list, different date → different list); near-miss
  edit-distance-1 classification; streak escalation weighting; survival-mode
  end condition; streak-freeze consumption (exactly one gap forgiven, not
  more).
- **Component tests**: live WPM converges to the Results-screen value at
  round end; locked vs. unlocked achievement rendering distinction on the
  new Stats screen; Results-screen hierarchy (Total visually dominant).
- **E2E (Playwright)**: daily challenge produces identical word order across
  two independent sessions on the same date; challenge-link share → fresh
  session → challenge landing state → play → compare flow; incorrect
  submission no longer requires a manual input clear (Phase 5 regression
  guard); mobile viewport confirms the `NoticeBanner` no longer reserves
  permanent layout space once dismissed.
- **Accessibility**: 0 serious/critical `axe-core` violations on `/stats`
  and the daily-challenge landing state, both themes — same bar as every
  existing screen (PLAN Phase 4 AC), not a lower one for new screens.
- **Regression**: every phase's exit criteria includes "all prior phases'
  tests (Phases 1–8, plus Phase 9 if undertaken) still green" — same
  standing rule as `PLAN-typester.md`.

## 🗂 Appendix — Research Provenance

This RFC synthesizes three independent research passes run against the
Phase 1–4 codebase on 2026-07-09:

1. **Retention/behavioral psychology pass** — audited the app against
   known mechanics from Wordle, Candy Crush, Duolingo, Wordscapes, NYT
   Games, and Trivia Crack; found the streak/achievement infrastructure
   built-but-inert, and the `game.ts` input-clear bug.
2. **UI/UX specialist pass** — audited against Monkeytype, TypeRacer,
   Wordle, and Duolingo's visual/interaction patterns, including live
   dev-server screenshots in both themes and a mobile viewport; found the
   missing live-WPM/look-ahead gap and the generic-visual-identity finding.
3. **Product strategy pass** — positioned Typester against Monkeytype,
   TypeRacer, 10fastfingers, Wordle/NYT Games, Duolingo, and Wordscapes;
   produced the competitive-positioning table and the Phase 9 tension this
   RFC carries forward rather than resolving.

All three reports independently and without prompting flagged the same two
things as the highest-priority gaps: the invisible achievements system, and
the share artifact's failure to produce a comparable, dated result. That
convergence, from three differently-angled passes, is the strongest single
signal in this entire exercise and is why Phases 6 and 7 are sequenced
first.
