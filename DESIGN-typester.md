# Design: Typester

> Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). This is the living
> design-system reference: tokens, components, and screen-by-screen behavior
> — concrete and specific enough to hold every screen to a binary bar,
> rather than "make it look nice."

## Design philosophy

Typester is a **speed** game. Every design decision should either make the
core loop (see word → type word → get instant feedback) feel faster and more
satisfying, or get out of the way. Four rules:

1. **The typing field is the product.** Nothing should compete with it for
   attention while a round is live. Chrome recedes; the current word and the
   input are the largest, highest-contrast elements on screen.
2. **Feedback is instant and physical.** Correct/near-miss/incorrect/combo/
   timeout each get a distinct, sub-150ms visual + audio cue. No feedback
   should require the user to read text to understand what happened.
3. **Calm everywhere else.** Home, Settings, Help are quiet, generously
   spaced, and slow down the motion — contrast is what makes the Game
   screen's speed feel intentional rather than just "busy."
4. **Every number Typester already computes gets a place to be seen twice**:
   once in the moment (Results, live during a round), and once later, at
   rest (Stats screen, Home teaser). A stat that only ever appears once, in
   passing, is a design defect.

## Tokens

All tokens are CSS custom properties on `:root`, consumed directly by
Tailwind v4's `@theme` — no hardcoded hex/px values anywhere else in the app.

### Color — OKLCH, light + dark

OKLCH is used because it's perceptually uniform: lightening/darkening a token
by a fixed `L` step looks consistent across hues, which plain HSL doesn't
guarantee. Every color below is defined once per theme; components never
hardcode a color.

```css
:root {
  /* Brand — text/link/decorative use vs. filled buttons/badges each need a
     different lightness to hit 4.5:1 in their own context. */
  --color-accent: oklch(42% 0.19 265); /* indigo-leaning blue */
  --color-accent-strong: oklch(38% 0.2 265);

  /* Energy accent — a distinct warm hue reserved for in-round momentum
     (combo multiplier, power words, streak) so it never competes with
     --color-accent's job of marking primary actions/navigation. */
  --color-energy: oklch(52% 0.19 55);
  --color-energy-strong: oklch(46% 0.2 55);

  /* Semantic feedback — must stay legible at both lightness extremes */
  --color-success: oklch(70% 0.17 152); /* correct word */
  --color-danger: oklch(63% 0.22 25); /* incorrect word / time up */
  --color-warning: oklch(78% 0.15 85); /* low time remaining / near-miss */

  /* Light theme surface/text */
  --color-bg: oklch(98% 0.003 265);
  --color-surface: oklch(100% 0 0);
  --color-surface-raised: oklch(96% 0.004 265);
  --color-text: oklch(20% 0.01 265);
  --color-text-muted: oklch(46% 0.01 265);
  --color-border: oklch(90% 0.005 265);
}

:root[data-theme='dark'] {
  --color-bg: oklch(18% 0.01 265);
  --color-surface: oklch(23% 0.012 265);
  --color-surface-raised: oklch(28% 0.014 265);
  --color-text: oklch(96% 0.003 265);
  --color-text-muted: oklch(70% 0.01 265);
  --color-border: oklch(32% 0.012 265);
  /* accent/energy/success/danger/warning L bumped for dark-surface contrast */
  --color-accent: oklch(72% 0.18 265);
  --color-energy: oklch(78% 0.17 60);
  --color-energy-strong: oklch(70% 0.19 58);
  --color-success: oklch(76% 0.16 152);
  --color-danger: oklch(70% 0.2 25);
  --color-warning: oklch(82% 0.14 85);
}
```

Default theme follows `prefers-color-scheme`; `data-theme="light"|"dark"` on
`<html>` overrides it when the user picks explicitly in Settings (persisted
via `StorageService`).

**Contrast requirement (binary AC)**: `--color-text` on `--color-bg` and
`--color-text` on `--color-surface` must both measure ≥4.5:1 (WCAG AA normal
text) in both themes — verify with any contrast checker before shipping a
token change. Locked/muted UI (e.g. Stats' locked achievement chips) stays
legible by relying on `--color-text-muted`'s existing contrast margin rather
than further opacity fades, which can drop below 4.5:1.

### Typography

Two self-hosted variable fonts (no Google Fonts CDN — avoids a third-party
network request, keeps the PWA fully offline-capable, and avoids any
per-request tracking):

- **UI text**: Inter (OFL-licensed, self-hosted `.woff2`) — chrome, buttons,
  body copy, Settings/Help/Stats.
- **Word display + typing input**: a monospace, e.g. JetBrains Mono or Geist
  Mono (both OFL/open, self-hosted) — used for the current word, the
  look-ahead word strip, the answer field, and the share card. Monospace
  here is a deliberate identity choice, not a default: it reads as
  "precision instrument" and every character advances the same visual
  distance, which makes mis-typed-character feedback (see §Game screen)
  land in a predictable position.

```css
:root {
  --font-ui: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.5rem;
  --text-word: clamp(2.5rem, 8vw, 5rem); /* the current word, always huge */
}
```

### Spacing & radius

4px base scale (Tailwind's default already aligns with this — no custom
override needed beyond confirming `--radius-*` for the native `<dialog>` and
card surfaces):

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1.25rem;

  /* Elevation - one scale for both themes; what conveys "raised" is the
     surface-fill step (surface-raised vs surface), not the shadow color. */
  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 8%);
  --shadow-md: 0 4px 16px oklch(0% 0 0 / 12%);
  --shadow-lg: 0 8px 32px oklch(0% 0 0 / 20%);
}
```

### Motion

```css
:root {
  --duration-instant: 100ms; /* keystroke feedback */
  --duration-fast: 180ms; /* button press, toast in */
  --duration-base: 260ms; /* route transitions, picker/banner expand */
  --duration-slow: 420ms; /* results reveal */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* combo/success pop */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-slow: 0ms;
  }
}

/* Settings' explicit Motion override always wins over the media query above. */
:root[data-motion='full'] {
  --duration-instant: 100ms;
  --duration-fast: 180ms;
  --duration-base: 260ms;
  --duration-slow: 420ms;
}
:root[data-motion='reduced'] {
  --duration-instant: 0ms;
  --duration-fast: 0ms;
  --duration-base: 0ms;
  --duration-slow: 0ms;
}
```

**Binary AC**: every `transition`/`animation` in the app must reference one
of these duration tokens — so the single reduced-motion override above makes
the entire app instant, with no per-component reduced-motion branching logic
needed. This applies equally to newer motion (the Home auto-typing preview,
the word look-ahead strip's shift animation): both freeze/instant-swap
rather than just running slower.

Route transitions use the Router's `withViewTransitions()` (native View
Transitions API) — a cross-fade/slight-scale between screens. Within-screen
micro-interactions (button press, word-correct pop, combo glow) are plain CSS
transitions/keyframes using the tokens above.

### Sound

Synthesized via Web Audio API (`SoundService`, ARCHITECTURE.md §D7) — no
shipped audio files. Five cues, each ≤150ms:

| Event                             | Character              | Rough synthesis                     |
| ---------------------------------- | ----------------------- | ------------------------------------ |
| Correct word                      | short, bright, rising   | sine, 660→880Hz, 80ms, quick decay   |
| Near-miss (1-char typo)           | incorrect, pitched up   | square, 260Hz, 100ms, quick decay    |
| Incorrect word                    | short, low, flat        | square, 180Hz, 100ms, quick decay    |
| Combo milestone (every 5 streak)  | bright arpeggio         | 3 sine notes ascending (660/880/1100Hz), 120ms total |
| Time up / round end               | soft descending tone    | sine, 440→220Hz, 300ms               |

All cues respect a `soundEnabled` setting (default **on**, one tap to mute in
Settings) and must never play if the tab is backgrounded (use the Page
Visibility API to suppress, not just to save battery but because a sound
firing from a backgrounded tab reads as a bug, not a feature).

### Background texture

A faint dot grid in light mode; dark mode gets a distinct scanline texture
rather than a pure lightness inversion of the same pattern — reinforces the
"precision instrument" framing where it's cheapest to add (`styles.css`,
under `:root[data-theme='dark']` and the matching `prefers-color-scheme:
dark` block). The share card reuses the same texture pair so a shared image
matches the theme it was generated in.

## Shared UI primitives (`shared/ui`)

Each is a standalone Angular component, signal `input()`/`output()` only, no
`@Input()`/`@Output()` decorators, styled entirely from tokens:

| Component          | Behavior spec                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`            | Variants: primary (accent fill), secondary (outline), ghost (text-only, used for "return to menu"). Press state scales to 97% over `--duration-instant`. Focus-visible ring uses `--color-accent` at 2px offset — never removed, only restyled.                                                                                                                                                        |
| `SegmentedControl`  | Used for mode/difficulty/duration/lives/word-pack pickers. Full keyboard support: arrow keys move selection, Enter/Space confirms. Selected segment settles with a spring pop (CSS `transform`, not layout-triggering properties). `variant="card"` + an `optionTemplate` renders taller icon+label choice cards instead of the compact pill; wraps onto multiple rows once five or more options are present rather than overflowing. |
| `Toggle`            | `role="switch"` button, not a restyled checkbox. Optional `label`/`description` render a full settings-row (text leading, switch trailing); bare (icon-only) usage falls back to `ariaLabel`.                                                                                                                                                                                                           |
| `StatBadge`         | Label + number (score, WPM, accuracy, streak). Number changes animate via a brief scale-pop (`--ease-spring`) on update, not a re-render flash.                                                                                                                                                                                                                                                          |
| `TimerRing`         | SVG circular countdown, `stroke-dashoffset` driven by a signal `computed()` from remaining time — no `setInterval` DOM writes. Ring color shifts from `--color-accent` → `--color-warning` at 20% time remaining → `--color-danger` at 10%. Not used in Endless/Survival mode (see below).                                                                                                             |
| `Toast`             | Non-blocking transient message (e.g. "Settings saved", "Copied to clipboard"). `role="status"`, `aria-live="polite"`, auto-dismiss 3s, dismissible early via Escape/click.                                                                                                                                                                                                                              |
| `Dialog`            | Uses the native `<dialog>` element (`showModal()`) for confirmation/help overlays — free focus-trapping and Escape-to-close from the platform, no custom a11y reimplementation needed. Uses `--shadow-lg` for depth against the backdrop. Used for the Game screen's exit-confirmation flow.                                                                                                           |
| `NoticeBanner`      | An in-flow, dismissible top bar (not `position: fixed`) — it pushes content down while visible and reclaims the space entirely once dismissed. Used once app-wide, in the app shell, for the first-visit local-storage disclosure.                                                                                                                                                                     |

### Icon set

Inline SVGs (Theme/Motion in Settings, Exit in Game) share one distinguishing
trait: every icon terminates one stroke in a short flat "cursor" cap
(mirroring `.home__caret`'s rectangle shape) rather than a rounded/butt line
cap, so the set reads as Typester's own rather than a generic default.
`viewBox="0 0 24 24"`, `stroke-width="2"` throughout.

## Screens

### Home

- Big, quiet: app name, an auto-typing hero preview (see below), then
  actions as full-width `Button`s, generously spaced (`--space-8` between
  groups): Quick Play, Game Modes, Typester Daily, Help, Settings, Your
  Stats.
- **Auto-typing preview**: a `--font-mono` string that types/holds/clears
  through a small fixed set of short words sampled from the word bank,
  looping on a timer, with a blinking caret reusing `.home__caret`. Purely
  decorative (`aria-hidden`); a static `sr-only` paragraph carries the same
  meaning for screen readers. Frozen under `prefers-reduced-motion` rather
  than looping. Purpose: a first-time visitor sees what the mechanic looks
  like before clicking anything.
- Selecting "Game Modes" reveals mode (Timed/Endless) via `SegmentedControl`,
  then difficulty, then duration-or-lives, then an optional word pack — all
  inline (no page navigation until the actual round starts), animated with a
  height-auto expand using `--duration-base`/`--ease-standard`.
- Confirming a mode navigates to `/play/:mode/:difficulty/:duration`
  (optionally `?pack=<id>`); Quick Play navigates to
  `/play/quick/mixed/:duration` using the player's configured Quick Play
  duration.
- **Returning-player teaser row**: once the player has any recorded result,
  a small chip row surfaces the day streak and a recent best score —
  everything Typester already computes gets a place to be seen at rest, not
  just once on Results.
- **Day-streak "at risk" banner**: when the streak is intact but today's
  round hasn't been played yet, an in-flow `NoticeBanner`-style card (not
  the fixed app-shell banner) prompts "Play today to keep your {n}-day
  streak" with a direct Quick Play action. If a streak-freeze token is about
  to cover an actually-missed day, a calmer variant makes that save visible
  rather than silent.
- **Challenge-link landing state**: when Home loads with a challenge link's
  encoded query params (`mode`, `difficulty`, `duration`, `score`, `wpm`),
  the standard hero is replaced entirely by a challenge frame — "{score}
  pts ({wpm} WPM) on {mode}/{difficulty}/{duration} — think you can beat
  it?" with a primary "Accept Challenge" action that pre-fills the exact
  config and starts immediately, and a ghost "Play Typester normally" link
  back to the standard Home. This is a landing-state override, not a
  persistent app mode — it doesn't survive a reload without the query
  param.

### Game

- Layout, top to bottom: a `TimerRing` for Quick Play/Timed, or a row of
  "lives remaining" dots in the same slot for Endless/Survival (filled dot
  per mistake still available); a word look-ahead strip (see below); the
  answer `<input>` directly beneath it (`--font-mono`, auto-focused, cleared
  and re-focused after every submit — zero click required for the whole
  round); then a stat row (`StatBadge` × Score, Streak, live WPM).
- **Word look-ahead strip**: replaces a single centered word with the
  current word (`--text-word`, full opacity) plus the next 1–2 words shown
  smaller and progressively faded to the right, so the upcoming word is
  never a surprise. On each submit, the strip shifts left with a brief pulse
  animation; under reduced motion the content swaps instantly instead.
- **Escalating difficulty**: for Timed and Endless rounds (not Quick Play),
  the round's word list is reordered shorter-words-first by splitting
  around the median word length, so later words in a round trend longer —
  made visually legible via the spotlight glow behind the word intensifying
  as the round progresses, not a numeric "level" counter.
- On submit: correct → word and input both flash `--color-success` for
  `--duration-instant`, `SoundService` fires the correct (or combo, every
  5th streak) cue, next word appears immediately. A near-miss (typed value
  exactly one character off) gets its own `--color-warning` treatment — a
  smaller shake amplitude than a full miss and a pitched-up incorrect tone —
  distinct from, but not more lenient than, a full incorrect: the streak
  still resets either way. A genuinely incorrect submission flashes
  `--color-danger`, and a per-character diff underlines exactly which
  keystrokes were wrong against the target word.
- Score/streak/live-WPM changes are announced via a visually-hidden
  `aria-live="polite"` region so screen-reader users get the same instant
  feedback sighted users get from color/motion.
- On round end (timeout, mistake limit reached in Endless, or word-list
  exhaustion): a brief `--duration-slow` transition to the Results screen —
  not an abrupt route swap.
- **Exit flow**: Escape or a corner button opens a `Dialog` exit-confirm;
  the round timer genuinely pauses while it's open. Options are save-and-
  exit (scores as if time ran out), discard, or resume.
- **Modes**: Quick Play (fixed easy/medium/hard word composition, legacy
  behavior preserved), Timed (full difficulty-tier pool, clock-based),
  Endless/Survival (no clock — ends after a chosen number of mistakes).
- **Word packs**: an optional themed word source (Movies & TV, Tech/
  Programming, Science, Everyday), opt-in via Home, Timed/Endless only —
  bundled and curated the same way as the base word bank, bypassing the
  live word fetch entirely. Quick Play and the daily challenge always use
  their own fixed sources regardless of a selected pack.

### Results

- `.results__total`: Total score alone, large, `--color-accent`, above the
  rest. Secondary row: the remaining `StatBadge`s (Score, Time Bonus, WPM,
  Accuracy) at the existing size, muted labels.
- If the round beat the stored best for this exact `mode+difficulty+
  duration` combination, a "New Best" badge plus a one-shot confetti burst
  marks it.
- Any achievement unlocked this round renders as a celebratory chip row
  (accent-tinted fill, not the locked/muted look) beneath the stat grid — an
  unlock should read as an unlock at a glance. When nothing unlocks this
  round, the single closest miss is shown instead (e.g. "6 more WPM for the
  50 WPM Club") rather than nothing, so a null result still shows a
  specific, visible gap.
- Daily-challenge results show a "Typester Daily #N" eyebrow line, plus a
  note when a streak freeze covered a gap.
- Three primary actions: "Play Again" (same config, restarts immediately),
  "Share", and "Menu" (ghost, returns home). A fourth, lower-emphasis ghost
  action appears only when this round was a new best: "New best — try
  {combo}?", suggesting the next not-yet-beaten config in the fixed 10-combo
  set, never one already beaten this session.
- **Share**: generates a 1200×630 `<canvas>` PNG (see `ShareCardService`)
  matching the player's current theme — score/WPM headline, mode/difficulty/
  duration or "Typester Daily #N", a best-streak dot row, background
  texture, small wordmark. Where the platform supports file sharing
  (`navigator.canShare({ files })`), the PNG and share text go out together
  via `navigator.share()`; otherwise it falls back to text-only sharing
  (Web Share text, then `navigator.clipboard.writeText()` with a
  confirmation `Toast`). Share text: `"Scored {score} pts at {wpm} WPM on
  {label} — {url}"`, where `label` is "Typester Daily #N" for a daily result
  or plain "Typester" otherwise, and the URL is either the daily-challenge
  link or an encoded challenge link carrying this result's config/score/WPM.

### Stats (`/stats`)

Reachable via a ghost `Button` on Home (same pattern as Help/Settings), reads
`StorageService.stats` directly — no separate service. Sectioned with the
same labeled-card treatment established on Settings (`--shadow-sm`,
`--color-border`, uppercase eyebrow label per section):

1. **Summary row**: day streak (with a streak-freeze count if any), rounds
   played, total words typed.
2. **Best scores grid**: all 10 mode/difficulty/duration combinations
   (Quick Play + 3 difficulties × 3 durations). Beaten combos show their
   score; unbeaten combos show a muted "not yet attempted" placeholder with
   a direct "Play" action.
3. **Achievements**: the full achievement set as chips — unlocked ones in
   the celebratory style from Results, locked ones visibly locked (muted
   fill, dashed border, lock glyph — not just faded, since further opacity
   would drop below WCAG AA contrast) with a count in the section header.
   This is what makes the achievement system function as a retention
   mechanic instead of a one-shot Results toast.

## Gamification

Layered on top of the base scoring in `game-engine.ts` — additive, not a
replacement for the legacy point values (easy/medium/hard = 1/2/3 pts/word):

- **Streak combo multiplier**: every 5 consecutive correct words bumps a
  score multiplier (×1, ×1.5, ×2, capped at ×2) applied to subsequent words
  until a mistake resets the streak to ×1. Mirrors the "combo milestone"
  sound cue — same trigger, now with a scoring consequence, not just audio.
- **Power words**: roughly 1 in 8 words drawn during a round is flagged as a
  power word — visually marked with a subtle glow/`--color-energy` underline
  on the word display — worth double its tier's base points if typed
  correctly. Selection is random per round, not predictable.
- **Near-miss feedback**: a submission exactly one character off from the
  target is distinguished visually and audibly from a full miss, but is not
  scored any differently — the streak resets either way. A feedback
  distinction only, so it can't blur the streak mechanic's loss-aversion
  teeth.
- **Achievements**: a fixed set — First Round, 30/50/70/90/110 WPM Club,
  Perfect Accuracy, 10-Streak, 7/30/100-Day Streak, Every Difficulty
  Beaten — tracked in `Stats` via `StorageService`, evaluated at round end,
  surfaced as chips on Results the round they're first earned and listed
  (earned/locked) on the Stats screen. No points value of their own —
  status only.
- **Day streak & streak freeze**: consecutive UTC calendar days with at
  least one finished round. One freeze token is earned every time the
  streak crosses a multiple of 7 and forgives exactly one missed day —
  scarce and earned by design, never unlimited, so it doesn't remove the
  loss aversion the streak mechanic exists to create.
- **Daily challenge**: a fixed config (Timed, Medium, 60s) seeded
  deterministically from the UTC calendar date, so every player who plays
  "today" gets byte-identical word order — always drawn from the bundled
  word bank, never the live per-round fetch, so results are genuinely
  comparable. Recorded into its own `Stats.dailyResults` bucket, never
  conflated with the regular best-scores table.
- **Challenge links**: a non-daily result's config + score/WPM, packed into
  plain query params so a shared link can render Home's challenge-landing
  state for whoever opens it. Self-reported and unverifiable (no backend) —
  never presented in copy as "verified" or a "leaderboard."

### Settings

- Grouped into labeled sections (Appearance, Sound, Gameplay), each an
  elevated card (`--shadow-sm`, `--color-border`) under a small uppercase
  eyebrow label — fields read as a designed surface, not a loose stack of
  form controls.
- Appearance: Theme (light/dark/system) and Motion (full/reduced/system —
  mirrors `prefers-reduced-motion` but allows an explicit override) are
  `SegmentedControl` `variant="card"` icon+label choices (sun/moon/monitor;
  bolt/pause/monitor), not plain dropdowns or a bare pill row.
- Sound is a `Toggle` with a label _and_ a one-line description of what it
  does, not a bare "Sound" checkbox.
- Quick Play duration (number input, 15–300s) is the one field still backed
  by Signal Forms, since it's the only one with a real validation
  constraint; Theme/Motion/Sound are plain signals (no different from
  Home's difficulty/duration pickers).
- Every field persists on change (no separate "Save" button); a quiet
  footnote states this explicitly rather than leaving it implicit. Writes
  happen synchronously in the same change handler that updates the local
  signal, not via an `effect()` — an effect's flush isn't tied to the
  triggering event, so a click immediately followed by navigation could
  race ahead of it and silently drop the write.

### Help

- Static FAQ (question/answer pairs), each item a `<details>`/`<summary>`
  native disclosure (free keyboard support and semantics) rather than an
  always-expanded list.

## Responsive behavior

- Single-column, mobile-first. `--text-word` already scales via `clamp()`.
- On narrow viewports, the Game screen's word look-ahead strip drops to
  current + next word only (no third slot) — legibility of the current word
  takes priority over showing three words on a small screen.
- Container queries (not just viewport media queries) on the Game screen's
  root so the word/input/timer group re-proportions correctly whether it's
  full-width on mobile or centered in a max-width column on desktop.
- Breakpoints follow Tailwind v4 defaults (`sm`/`md`/`lg`/`xl`) — no custom
  breakpoint scale needed.
- `SegmentedControl` wraps onto multiple rows rather than overflowing once
  five or more options are present (e.g. the word-pack picker).

## Accessibility checklist (binary)

- [ ] All interactive elements reachable and operable via keyboard alone, in
      a logical tab order, with no keyboard traps.
- [ ] Focus-visible styles present on every interactive element (never
      `outline: none` without a replacement).
- [ ] Score, streak, live-WPM, and timer-critical state changes exposed via
      `aria-live="polite"` (or `assertive` only for round-end).
- [ ] Color is never the only signal (correct/near-miss/incorrect also
      differ in icon/shake-amplitude/motion, not just hue) — relevant for
      the ~8% of users with color vision deficiency.
- [ ] `prefers-reduced-motion: reduce` collapses all durations to `0ms` (see
      §Motion), and freezes/instant-swaps the Home auto-typing preview and
      the Game word look-ahead strip specifically — verified, not assumed.
- [ ] Both themes pass 4.5:1 text contrast (§Color), including locked
      achievement chips (muted token, not opacity-faded).
- [ ] Zero serious/critical `axe-core` violations on every screen, both
      themes. `e2e/accessibility.spec.ts` scans Home (including the
      challenge-link landing state), Help, Settings, Stats, the legal
      pages, and the daily-challenge Game route; Results isn't
      independently navigable (it reads router state, not a route param)
      and isn't yet covered by a dedicated axe scan.
