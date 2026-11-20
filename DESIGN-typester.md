# Design: Typester

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). Tokens live in
`src/styles.css`; this file says what they are for and the rules screens
follow.

## Idea

The one physical object is a keycap. Every letter you type is a keycap that
presses down when you get it right, and every primary action is a keycap
too. Everything else stays flat and quiet so the keys carry the screen.

1. **The word is the screen.** During a run nothing competes with the
   current word. The HUD and meter sit at the edges in muted ink.
2. **Feedback is physical and immediate.** A hit presses the key, turns it
   ultramarine and plays a note. A miss shakes the word, turns the cursor
   and next letter red, and plays a low thud. Words finish with confetti and
   floating points. No feedback needs reading.
3. **Heat shows momentum.** The board warms towards marigold as the
   multiplier climbs, and the multiplier keycap turns gold above ×1.
4. **Every number gets a second look.** Live in the meter, then on results,
   then at rest on Home and Stats.

## Tokens

### Colour

Light is a lilac keyboard case with white caps; dark is the same keyboard at
night. Colour roles are the same in both.

| Token           | Light     | Dark      | Use                                     |
| --------------- | --------- | --------- | --------------------------------------- |
| `--bg`          | `#e7e8f2` | `#15162a` | page                                    |
| `--bg-deep`     | `#d9dbea` | `#0e0f20` | panels, tracks, `kbd`                   |
| `--key`         | `#fcfcff` | `#2b2d50` | keycap top                              |
| `--key-side`    | `#bcc0d9` | `#0a0b18` | keycap skirt (the solid shadow)         |
| `--ink`         | `#17182e` | `#edeeff` | text                                    |
| `--ink-soft`    | `#505372` | `#a7aad0` | secondary text                          |
| `--accent`      | `#3b2be0` | `#a59bff` | links, cursor, chart line               |
| `--accent-fill` | `#3b2be0` | `#5644ff` | typed keys, primary button (white text) |
| `--gold`        | `#ffb21e` | same      | gold words, multiplier, heat            |
| `--miss`        | `#c8173d` | `#ff7089` | misses, low time                        |
| `--miss-key`    | `#ff8fa6` | `#b3264a` | full-heat key on the miss map           |

All text pairs pass 4.5:1 in both themes; the axe suite checks this on every
screen. Never fade text with opacity to make it secondary; use `--ink-soft`.

### Type

One family, Recursive (OFL, self-hosted, `public/fonts/recursive-casl.woff2`,
weight 300 to 1000 plus the Casual axis), in two registers:

- `--casual` (`CASL 1`): keycap legends, scores, clocks, mode names, page
  titles. This is the game's voice.
- `--linear` (`CASL 0`): everything else.

Sizes: `--text-sm` 0.875rem, `--text-base` 1rem, `--text-lg` 1.25rem,
`--text-xl` 1.75rem, `--text-2xl` 2.75rem, `--text-hero` up to 7.5rem
(results score). Numbers that change use `tabular-nums`. Sentence case
everywhere; no all-caps labels.

### Keycaps

`.key` in `styles.css`. A cap sits on a solid shadow of `--key-side`,
`--travel` (6px) deep. Pressed (`.is-down` or `:active`) it drops by
`--travel - 1px`. Variants: `.key--accent` and `.key--gold`. Smaller caps
set a smaller `--travel`. Game keycaps size themselves to fit the word
(`--cap` in `keycap-word.ts`, from the container width and letter count).

### Motion

`--d-instant` 80ms (key travel), `--d-fast` 160ms, `--d-base` 240ms (shake),
`--d-slow` 420ms (results rise, heat). Every transition and animation uses
one of these. Reduced motion, from the system or the Settings override,
sets them all to 0ms, and the confetti canvas and floating points switch
off.

## Screens

**Home.** The word "typester" as keycaps. Typing it starts a Rush (or the
challenged mode on a challenge link); keys 1 to 4 start a mode directly.
Below it, the four modes as rows with a numbered keycap, a one-line blurb and
your best, today's Daily score, or your weakest keys for Drill. Day streak
underneath when it is above zero.

**Play.** HUD: End (Esc), mode name, clock; a bar under it drains as time
runs out and turns red under 5 s. Centre: the current word in keycaps, a
cursor bar under the next letter, the next three words as plain text (two on
narrow screens). Meter: score, the multiplier keycap with a bar towards the
next step, level, WPM, words ahead or behind your best, and the score to
beat on a challenge. On phones the board and meter stack at the top so the
on-screen keyboard does not cover them.

**Results.** Mode name and score at hero size, a gold "New best" keycap when
earned, one line comparing with your best (and with a challenge score), then
WPM, accuracy, level, longest combo. Play again (Enter), Share, Menu (Esc).
Two panels: words over time against your previous best, and the miss map
with a link to Drill.

**Stats.** Streak, totals, bests per mode, WPM for the last 40 runs as bars
(latest in gold), lifetime miss map and your worst letters.

**Settings.** Theme and Motion as radio keycaps (the chosen one stays
pressed), Sound as a switch, and Clear scores with a second press to
confirm. Every change saves at once.

## Accessibility

- The real `<input>` covers the board, so focus, IME and on-screen keyboards
  work normally. Its label names the current word; a polite live region
  announces each new word, level-ups and lost combos.
- The keycap row is `aria-hidden`; the miss map and charts carry text
  equivalents.
- Results move focus to their heading. Every interactive element has a
  visible focus ring. Touch devices get 44px link targets and lose the
  keyboard hints.
- Colour is never the only signal: misses also shake, typed keys are also
  pressed down.
