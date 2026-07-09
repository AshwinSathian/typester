# Design: Typester

> Companion to [PLAN-typester.md](./PLAN-typester.md) — implements Phase 3.
> A note on provenance: the user asked for an "impeccable" design skill that
> is not available in this environment. This document is the substitute —
> concrete, opinionated, and specific enough that Phase 3's tasks have binary
> acceptance criteria, rather than "make it look nice."

## Design philosophy

Typester is a **speed** game. Every design decision should either make the
core loop (see word → type word → get instant feedback) feel faster and more
satisfying, or get out of the way. Three rules:

1. **The typing field is the product.** Nothing should compete with it for
   attention while a round is live. Chrome recedes; the current word and the
   input are the largest, highest-contrast elements on screen.
2. **Feedback is instant and physical.** Correct/incorrect/combo/timeout each
   get a distinct, sub-150ms visual + audio cue. No feedback should require
   the user to read text to understand what happened.
3. **Calm everywhere else.** Home, Settings, Help are quiet, generously
   spaced, and slow down the motion — contrast is what makes the Game
   screen's speed feel intentional rather than just "busy."

## Tokens

All tokens are CSS custom properties on `:root`, consumed directly by
Tailwind v4's `@theme` (no hardcoded hex/px values anywhere else in the app —
this is a Phase 3 acceptance criterion, not a guideline).

### Color — OKLCH, light + dark

OKLCH is used because it's perceptually uniform: lightening/darkening a token
by a fixed `L` step looks consistent across hues, which plain HSL doesn't
guarantee. Every color below is defined once per theme; components never
hardcode a color.

```css
:root {
  /* Brand — a single accent hue, used sparingly (primary actions, combo glow) */
  --color-accent: oklch(64% 0.19 265); /* indigo-leaning blue */
  --color-accent-strong: oklch(54% 0.21 265);

  /* Semantic feedback — must stay legible at both lightness extremes */
  --color-success: oklch(70% 0.17 152); /* correct word */
  --color-danger: oklch(63% 0.22 25); /* incorrect word / time up */
  --color-warning: oklch(78% 0.15 85); /* low time remaining */

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
  /* accent/success/danger/warning L bumped slightly for dark-surface contrast */
  --color-accent: oklch(72% 0.18 265);
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
text) in both themes — verify with any contrast checker before Phase 3 exit.

### Typography

Two self-hosted variable fonts (no Google Fonts CDN — avoids a third-party
network request, keeps the PWA fully offline-capable, and avoids any
per-request tracking):

- **UI text**: Inter (OFL-licensed, self-hosted `.woff2`) — chrome, buttons,
  body copy, Settings/Help.
- **Word display + typing input**: a monospace, e.g. JetBrains Mono or Geist
  Mono (both OFL/open, self-hosted) — used for the current word and the
  answer field specifically. Monospace here is a deliberate identity choice,
  not a default: it reads as "precision instrument" and every character
  advances the same visual distance, which makes mis-typed-character
  feedback (see §Game screen) land in a predictable position.

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
  --duration-base: 260ms; /* route transitions */
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
```

**Binary AC**: every `transition`/`animation` in the app must reference one
of these duration tokens — so the single reduced-motion override above makes
the entire app instant, with no per-component reduced-motion branching logic
needed.

Route transitions use the Router's `withViewTransitions()` (native View
Transitions API) — a cross-fade/slight-scale between screens. Within-screen
micro-interactions (button press, word-correct pop, combo glow) are plain CSS
transitions/keyframes using the tokens above.

### Sound

Synthesized via Web Audio API (`SoundService`, D7 in the RFC) — no shipped
audio files. Four cues, each ≤150ms:

| Event                            | Character             | Rough synthesis                     |
| -------------------------------- | --------------------- | ----------------------------------- |
| Correct word                     | short, bright, rising | sine, 660→880Hz, 80ms, quick decay  |
| Incorrect word                   | short, low, flat      | square, 180Hz, 100ms, quick decay   |
| Combo milestone (every 5 streak) | bright arpeggio       | 3 sine notes ascending, 120ms total |
| Time up / round end              | soft descending tone  | sine, 440→220Hz, 300ms              |

All cues respect a `soundEnabled` setting (default **on**, one tap to mute in
Settings) and must never play if the tab is backgrounded (use the Page
Visibility API to suppress, not just to save battery but because a sound
firing from a backgrounded tab reads as a bug, not a feature).

## Shared UI primitives (`shared/ui`)

Each is a standalone Angular component, signal `input()`/`output()` only, no
`@Input()`/`@Output()` decorators, styled entirely from tokens:

| Component          | Behavior spec                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`           | Variants: primary (accent fill), secondary (outline), ghost (text-only, used for "return to menu"). Press state scales to 97% over `--duration-instant`. Focus-visible ring uses `--color-accent` at 2px offset — never removed, only restyled.                                                                                                                                                           |
| `SegmentedControl` | Used for difficulty/mode/duration pickers. Full keyboard support: arrow keys move selection, Enter/Space confirms. Selected segment settles with a spring pop (CSS `transform`, not layout-triggering properties). `variant="card"` + an `optionTemplate` renders taller icon+label choice cards instead of the compact pill (Settings' Theme/Motion) — same accessible radiogroup underneath either way. |
| `Toggle`           | `role="switch"` button, not a restyled checkbox. Optional `label`/`description` render a full settings-row (text leading, switch trailing); bare (icon-only) usage falls back to `ariaLabel`.                                                                                                                                                                                                             |
| `StatBadge`        | Label + number (score, WPM, accuracy, streak). Number changes animate via a brief scale-pop (`--ease-spring`) on update, not a re-render flash.                                                                                                                                                                                                                                                           |
| `TimerRing`        | SVG circular countdown, `stroke-dashoffset` driven by a signal `computed()` from remaining time — no `setInterval` DOM writes (fixes legacy defect #1). Ring color shifts from `--color-accent` → `--color-warning` at 20% time remaining → `--color-danger` at 10%.                                                                                                                                      |
| `Toast`            | Non-blocking transient message (e.g. "Settings saved"). `role="status"`, `aria-live="polite"`, auto-dismiss 3s, dismissible early via Escape/click.                                                                                                                                                                                                                                                       |
| `Dialog`           | Uses the native `<dialog>` element (`showModal()`) for confirmation/help overlays — free focus-trapping and Escape-to-close from the platform, no custom a11y reimplementation needed. Uses `--shadow-lg` for depth against the backdrop.                                                                                                                                                                 |

## Screens

### Home

- Big, quiet: app name, one-line tagline, then four actions (Quick Play,
  Game Modes, Help, Settings) as full-width `Button`s, generously spaced
  (`--space-8` between groups).
- Selecting "Game Modes" reveals difficulty via `SegmentedControl`, then
  duration via a second `SegmentedControl` — both inline (no page navigation
  until the actual round starts), animated with a height-auto expand using
  `--duration-base`/`--ease-standard`.
- Confirming a mode navigates to `/play/:mode/:difficulty/:duration`.

### Game

- Layout, top to bottom: `TimerRing` (top-center, modest size — this screen
  is about the word, not the clock), the current word in `--text-word`
  (`--font-mono`, uppercase, letter-spacing slightly widened for legibility
  at speed), the answer `<input>` directly beneath it (same `--font-mono`,
  auto-focused, cleared and re-focused after every submit — zero click
  required for the whole round), then a slim stat row (`StatBadge` × score,
  streak).
- On submit: correct → word and input both flash `--color-success` for
  `--duration-instant`, `SoundService` fires the correct cue, next word
  appears immediately. Incorrect → same but `--color-danger`, and the
  mistyped characters within the input are underlined against the target
  word (a Phase 3 stretch — see PLAN Open Questions if descoped).
- Score/streak changes are announced via a visually-hidden `aria-live="polite"`
  region so screen-reader users get the same instant feedback sighted users
  get from color/motion.
- On round end (timeout or word-list exhaustion): a brief `--duration-slow`
  transition to the Results screen — not an abrupt route swap.

### Results

- `StatBadge` grid: Score, Time Bonus, Total, WPM, Accuracy. If the round
  beat the stored best for this exact `mode+difficulty+duration` combination,
  show a distinct "New Best" `Toast`/badge treatment using `--ease-spring`.
- Any achievement unlocked this round (see §Gamification) renders as a small
  badge chip row beneath the stat grid — icon + label, no modal interruption.
- Three actions: "Play Again" (same config, restarts immediately), "Share"
  (see below), and "Menu" (ghost button, returns home).
- **Share**: composes `"Scored {score} pts at {wpm} WPM on Typester ({mode}/
{difficulty}) — {url}"`. Calls `navigator.share()` when available (mobile
  Safari/Chrome); falls back to `navigator.clipboard.writeText()` plus a
  `Toast` ("Copied to clipboard") when the Web Share API isn't present
  (most desktop browsers). No image/canvas rendering — text only, kept
  simple and fast.

## Gamification

Layered on top of the base scoring in `game-engine.ts` — additive, not a
replacement for the legacy point values (easy/medium/hard = 1/2/3 pts/word):

- **Streak combo multiplier**: every 5 consecutive correct words bumps a
  score multiplier (×1, ×1.5, ×2, capped at ×2) applied to subsequent words
  until a mistake resets the streak to ×1. Mirrors the existing "combo
  milestone" sound cue (§Sound) — same trigger, now with a scoring
  consequence, not just audio.
- **Power words**: roughly 1 in 8 words drawn during a round is flagged as a
  power word — visually marked with a subtle glow/`--color-accent` underline
  on the word display — worth double its tier's base points if typed
  correctly. Selection is random per round, not predictable, so it can't be
  gamed by memorizing a fixed pattern.
- **Achievements**: a small fixed set (e.g. "First Round", "50 WPM Club",
  "Perfect Accuracy", "10-Streak", "Every Difficulty Beaten") tracked in
  `Stats` via `StorageService`, evaluated at round end, surfaced as badge
  chips on Results the round they're first earned and listed (earned/locked)
  on the Help or a dedicated Achievements panel. No points value of their
  own — status only, so they can't be used to inflate the leaderboard-style
  best-score numbers.

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
- Every field persists on change (no separate "Save" button — this directly
  fixes legacy defect #4, where Settings never actually saved anything); a
  quiet footnote states this explicitly rather than leaving it implicit.

### Help

- Static FAQ, same content shape as the legacy app (question/answer pairs),
  restyled: each item is a `<details>`/`<summary>` native disclosure (free
  keyboard support and semantics) rather than an always-expanded list.

## Responsive behavior

- Single-column, mobile-first. `--text-word` already scales via `clamp()`.
- Container queries (not just viewport media queries) on the Game screen's
  root so the word/input/timer group re-proportions correctly whether it's
  full-width on mobile or centered in a max-width column on desktop —
  chosen over viewport-only breakpoints because this component may
  eventually be embedded at different widths (e.g. a future share-preview
  card), and container queries make that free.
- Breakpoints follow Tailwind v4 defaults (`sm`/`md`/`lg`/`xl`) — no custom
  breakpoint scale needed.

## Accessibility checklist (binary, verified in Phase 4)

- [ ] All interactive elements reachable and operable via keyboard alone, in
      a logical tab order, with no keyboard traps.
- [ ] Focus-visible styles present on every interactive element (never
      `outline: none` without a replacement).
- [ ] Score, streak, and timer-critical state changes exposed via
      `aria-live="polite"` (or `assertive` only for round-end).
- [ ] Color is never the only signal (correct/incorrect also differ in icon/
      motion, not just hue) — relevant for the ~8% of users with color
      vision deficiency.
- [ ] `prefers-reduced-motion: reduce` collapses all durations to `0ms` (see
      §Motion) — verified, not assumed.
- [ ] Both themes pass 4.5:1 text contrast (§Color).
- [ ] Zero serious/critical `axe-core` violations on every screen, both
      themes (PLAN Phase 4 AC).
