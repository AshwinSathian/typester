# Design: Typester Growth & Retention Additions

> Companion to [DESIGN-typester.md](./DESIGN-typester.md) (baseline design
> system — tokens, primitives, and original five screens, unchanged) and
> [PLAN-typester-growth.md](./PLAN-typester-growth.md) (the phases/tasks/ACs
> this document provides visual/interaction detail for). Nothing here
> introduces a new token category, a new font, or a new UI kit — every
> addition below is built from the existing OKLCH/spacing/motion tokens and
> the existing shared UI primitives (`Button`, `SegmentedControl`, `Toggle`,
> `StatBadge`, `TimerRing`, `Toast`, `Dialog`).

## Design philosophy addendum

`DESIGN-typester.md`'s three rules (typing field is the product; feedback is
instant and physical; calm everywhere else) still hold. This document adds a
fourth, specific to the growth work:

4. **Every number Typester already computes gets a place to be seen twice**:
   once in the moment (Results, live during a round), and once later, at
   rest (Stats screen, Home teaser). A stat that only ever appears once,
   in passing, is treated as a design defect in this codebase going
   forward — this is the concrete lesson from the achievements-system
   audit finding in `PLAN-typester-growth.md`.

## Game screen additions

### Live WPM

Add a fourth `StatBadge` to `.game__stats`, alongside the existing Score and
Streak: `label="WPM"`, bound to a `liveWpm` `computed()` reading the session
snapshot's correct-character count and elapsed time, refreshed on the
existing 100ms tick (`TICK_INTERVAL_MS`, already present in `game.ts` — do
not add a second interval). Same visual treatment as the other stat badges;
no special emphasis needed here — the emphasis change belongs on Results
(see below), not mid-round, where the design philosophy's "chrome recedes"
rule still applies.

### Word look-ahead queue

Replace the single centered `.game__word` with a horizontal word strip:

- Current word: centered, `font-size: var(--text-word)`, `opacity: 1` —
  unchanged from the existing spec.
- Next word: `font-size: calc(var(--text-word) * 0.55)`, `color:
  var(--color-text-muted)`, `opacity: 0.55`, positioned to the right of the
  current word.
- Word-after-next: `font-size: calc(var(--text-word) * 0.4)`, `opacity:
  0.3`, further right.
- On each correct/incorrect submit, the whole strip translates left by one
  word-slot's width over `--duration-base` / `--ease-standard` (the same
  tokens already used for route transitions — no new duration value), with
  the newly-revealed upcoming word fading in from `opacity: 0`.
- Under `prefers-reduced-motion` / `data-motion="reduced"`: skip the
  translate, swap content directly. Duration tokens already collapse to
  0ms app-wide, so this is close to free.
- Mobile (narrow viewport): reduce to current + next word only (drop the
  third slot) rather than shrinking type size further — legibility of the
  current word takes priority over showing three words on a small screen.

### Near-miss feedback tier

A third `Feedback` state, `'near'`, alongside the existing `'correct'` /
`'incorrect'`:

- Triggered when the typed value's edit distance from the target word is
  exactly 1 (a single-character typo) and the submission is otherwise
  incorrect.
- `.game__word--near` / `.game__input--near`: `--color-warning` border and
  text color (not `--color-danger`).
- Shake keyframe at half the amplitude of the existing incorrect shake
  (`±2.5px` translateX instead of `±5px`), same `--duration-slow`.
- Sound cue: a variant of the existing incorrect tone, pitched slightly
  higher (reuse `SoundService`'s existing synthesis approach — a single
  parameter change, not a new cue category).
- The streak still resets on a near-miss exactly as it does on a full miss
  — this is a *feedback* distinction, not a scoring leniency. Do not let
  near-miss quietly become "half credit"; that would blur the streak
  mechanic's loss-aversion teeth (see `PLAN-typester-growth.md` §Risks).

## Home screen additions

### Auto-typing hero preview

Replace the static title/tagline block with a `.home__preview` element,
positioned above or behind the existing action buttons:

- A `--font-mono` string that auto-types 3–4 short words sampled from
  `shared/data/word-bank.ts`, character by character, with a blinking caret
  at the end reusing the exact `.home__caret` keyframe already defined
  elsewhere in the app.
- Clears and repeats on a ~4s loop.
- Implemented as a signal-driven `computed()` string slice plus a
  `setInterval` — matches the app's existing signal-first pattern, no new
  dependency.
- Under `prefers-reduced-motion`: freeze on the first fully-typed word
  (matching the pattern already used for `.home__caret` and
  `.game__word--power`) rather than looping.
- Purpose: a first-time visitor sees what the mechanic looks like before
  clicking anything — closes the "nothing here previews the game" gap.

### Challenge-link landing state

When Home loads with a challenge-link's encoded query params present
(`config`, `targetScore`, `wpm` — see `PLAN-typester-growth.md` Phase 6):

- Replace the standard hero with a challenge frame: "**{name/generic
  label} scored {score} pts ({wpm} WPM) on {mode}/{difficulty}/{duration} —
  think you can beat it?**" styled in `--color-accent`, with a single
  primary `Button` ("Accept Challenge") that pre-fills the exact config and
  starts the round immediately — no intermediate picker.
- Below the primary action, a smaller ghost link ("Play Typester normally")
  routes to the standard Home for anyone who arrived via a shared link but
  wants the regular menu instead.
- Does not persist across reloads without the query param — this is a
  landing-state override, not a new persistent app mode.

### Day-streak "at risk" banner

Replace the passive streak chip's current always-same treatment with a
state-dependent one:

- Default (streak intact, already played today): unchanged small muted
  chip, as today.
- At risk (streak intact, `lastPlayedDate` is yesterday, no round played
  yet today): promote to a `NoticeBanner`-style inline card (not the fixed
  bottom bar being removed per Phase 5 — a normal in-flow card), accent
  border, "Play today to keep your {n}-day streak" with a direct "Quick
  Play" action inline.
- If a streak-freeze token is available and about to be consumed today
  (i.e. yesterday was actually missed but a freeze covers it): show a
  distinct, calmer variant — "A streak freeze covered yesterday — play
  today to keep it going" — so the save is visible, not silent (per the
  retention research: loss aversion only works if the loss, or the save, is
  *felt*).

## Results screen rework

### Hierarchy

Restructure `.results__grid` into two tiers instead of one flat row of five:

- `.results__total`: Total score alone, `font-size: var(--text-2xl)` or
  larger, `color: var(--color-accent)`, positioned above the rest.
- Secondary row: the remaining four `StatBadge`s (Score, Time Bonus, WPM,
  Accuracy) at the existing size, in `--color-text-muted` labels.

### Achievement chips

Change `.results__achievement` from the current muted/disabled-tag look
(`--color-surface-raised` background) to a celebratory fill:
`color-mix(in oklch, var(--color-accent) 12%, var(--color-surface))`
background, `--color-accent-strong` text, a small inline checkmark/badge
glyph, keeping the existing staggered `results-chip-in` entrance animation.
An achievement unlock should read as an unlock at a glance, not require
reading the copy to tell it apart from a locked state.

### Next-combo cross-promotion

A secondary action row beneath Play Again / Share / Menu: when the round
just beat (or came close to) the current config's best, suggest the next
logical config in the 10-combo set ("New best on Easy/60s — try Easy/120s?")
as a fourth, lower-emphasis action (ghost `Button` variant). Never suggest a
config already beaten in the current session, to avoid a stale/looping
suggestion.

### Progress-toward-next-badge

When no achievement unlocks this round, show the single closest miss instead
of nothing ("6 more WPM for the 50 WPM Club") in the space the achievement
chip row would otherwise occupy. Converts a null result into a specific,
visible gap — same Zeigarnik-effect logic as the Stats screen's counter, applied
per-round.

## Stats / Progress screen (new)

New route (`/stats`), lazy-loaded like the other features, reachable via a
new ghost `Button` on Home (same pattern as the existing Help/Settings
links). Reads `StorageService.stats` directly — no new service.

Layout, top to bottom:

1. **Summary row**: day streak (with freeze-token count if any), rounds
   played, total words typed — reuse `StatBadge` as-is, no new primitive.
2. **Best scores grid**: all 10 mode/difficulty/duration combinations,
   iterated from `stats().bestScores`. Beaten combos show their score;
   unbeaten combos show a muted "not yet attempted" placeholder with a
   direct "Play" action — this is the cross-promotion surface for the
   10-combo set the original design left invisible.
3. **Achievements**: the full `ACHIEVEMENTS` array (including any Phase 7
   tiered additions) rendered as chips using the upgraded celebratory style
   from the Results rework above for unlocked ones; locked ones at ~40%
   opacity with a small lock glyph, so the entire possibility space is
   visible before it's earned — this is the single change that makes the
   achievement system function as a retention mechanic instead of a one-shot
   toast.

Sectioned with the same labeled-card treatment already established on the
Settings screen (`--shadow-sm`, `--color-border`, uppercase eyebrow label per
section) — Settings is explicitly the internal quality bar for this screen,
per the UI/UX audit's own assessment of it as the best-designed screen in
the app today.

## Share card (new visual artifact)

A client-side `<canvas>`-rendered image, generated at share time, replacing
the plain-text-only path as the primary share mechanism (text/clipboard
remains the fallback where `navigator.canShare({ files })` isn't supported):

- Fixed-aspect card (e.g. 1200×630, standard social-preview proportions).
- Background: `--color-surface` (themed to match the player's current
  theme), a subtle version of the app's dot-grid or (dark mode) scanline
  texture at low opacity.
- Headline: score and WPM in `--font-mono`, large, `--color-accent`.
- Secondary line: mode/difficulty/duration, or "Typester Daily #N" when
  the result is from a daily challenge (sub-brand per
  `PLAN-typester-growth.md` Phase 6).
- A small visual streak/combo indicator (e.g. a row of filled/unfilled dots
  representing the multiplier reached) — not a full chart, just enough
  visual texture that the card is recognizable at a glance the way a
  Wordle grid is, per the product research's framing of what a share
  artifact needs to do.
- App wordmark (`T|`) small, bottom corner — the one existing piece of
  custom identity in the app, finally reused somewhere beyond the header.
- No third-party rendering service, no server round-trip — pure client-side
  canvas, consistent with `PLAN-typester.md`'s rejection of a *dependency*
  on an image-rendering service, not of client-side canvas use.

## Dark mode personality

Per the UI/UX audit's finding that dark mode is currently a pure lightness
inversion: in `styles.css`, under `:root[data-theme='dark']` (and the
matching `prefers-color-scheme: dark` block), override the light theme's
dot-grid `background-image` with a faint repeating horizontal scanline
pattern:

```css
background-image: repeating-linear-gradient(
  0deg,
  color-mix(in oklch, var(--color-border) 40%, transparent) 0px,
  transparent 1px,
  transparent 3px
);
```

Same mechanism already in use for the light-mode background, different
pattern — no new token category, reinforces the "precision instrument"
framing specifically where it's cheapest to add.

## Icon set

Replace the inline SVGs currently used for Theme/Motion (Settings) and Exit
(Game) with a small custom set (6–8 icons) sharing one distinguishing trait:
every icon terminates one stroke in a short flat "cursor" cap (mirroring
`.home__caret`'s rectangle shape) rather than a rounded/butt line cap that's
indistinguishable from any other app's default icon set. Keep the same
`viewBox="0 0 24 24"`, `stroke-width="2"` conventions already in place, so
this is a drop-in visual swap, not a structural change to any consuming
component.

## Endless/Survival mode — visual treatment

Distinct from the timed modes so it doesn't feel like "the same screen with
no clock":

- `TimerRing` is replaced by a "lives remaining" indicator (small row of
  filled/unfilled dots, count = mistakes-allowed minus mistakes-made) in
  the same position the ring currently occupies — same slot, different
  content, no new layout.
- Word difficulty escalation (Phase 8) is made visually legible via the
  existing `.game__spotlight` glow intensifying as the round progresses,
  rather than a numeric "level" counter — keeps the "chrome recedes, word
  is the product" philosophy intact rather than adding a new HUD element.

## Accessibility checklist additions (binary, verified per phase)

- [ ] Near-miss feedback is distinguishable by more than color alone (shake
      amplitude difference, per §Game screen additions above) — same "color
      is never the only signal" rule as the base design system.
- [ ] Challenge-link landing state and Stats screen both pass 0
      serious/critical `axe-core` violations, both themes — same bar as
      every existing screen, not a lower one for new screens.
- [ ] Auto-typing Home preview and word look-ahead strip both fully respect
      `prefers-reduced-motion` (freeze/instant-swap, not just slower motion).
- [ ] Streak-freeze and near-miss states are announced via the existing
      `aria-live="polite"` region pattern, consistent with how score/streak
      changes are already announced.
