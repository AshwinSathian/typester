# Architecture: Typester

Typester 3 is a rewrite of the 2.x app. It kept the stack (Angular 22,
zoneless, Tailwind, Cloudflare static hosting) and replaced the game, the
screens and the data model. Design rules live in
[DESIGN-typester.md](./DESIGN-typester.md).

## Layout

```
src/app/
  core/
    engine.ts       the game: rules, scoring, clock, run summary. No Angular.
    words.ts        word supplies (levelled, seeded, drill), weak-key maths,
                    Daily date maths. No Angular.
    modes.ts        mode names and blurbs, the /play/:mode guard
    store.ts        everything persisted, one localStorage entry
    sound.ts        Web Audio synthesis
    share.ts        canvas share card, Web Share, clipboard fallback
  features/
    home/           typeable hero, mode list, streak
    play/           play.ts runs a game; results.ts is its end screen
    stats/, settings/, legal/
  ui/               keycap-word, key-map, race-chart, burst, page-header
  shared/data/words.ts   the bundled word list
e2e/                Playwright flows and axe scans
```

## Routes

| Route                            | Screen                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/`                              | Home. `?mode=rush&vs=1240` turns it into a challenge landing.                                               |
| `/play/:mode`                    | A run. `mode` is `rush`, `sprint`, `daily` or `drill`, checked by `modeGuard`. `?vs=` sets a score to beat. |
| `/stats`, `/settings`            | Stats, settings                                                                                             |
| `/privacy`, `/terms`, `/license` | Legal                                                                                                       |

Results are not a route. When a run ends, the play screen swaps its board
for the results panel, so Enter can restart without a navigation.

## The engine

`Run` in `core/engine.ts` takes a `Rules` object and a `WordSupply`
function, and is driven by two calls: `press(char, now)` and `tick(now)`.
Time is always passed in, so tests control the clock and the class needs no
timers. Rules:

- A keystroke is a hit (the next letter) or a miss. A miss is never inserted,
  so there is nothing to backspace. The last letter completes the word.
- Points per word: letters × 10 × multiplier, doubled for gold words.
- The multiplier steps at 20, 50, 100 and 180 clean keystrokes in a row
  (×2 to ×5). Any miss resets it to ×1.
- Level goes up every 6 words. Word length bands widen with level
  (`lengthBand` in `words.ts`).
- Bank clock (Rush, Daily): starts at 15 s, each word adds
  `letters × 520 ms × 0.88^(level-1)` (×1.5 for gold), capped at 30 s in
  the bank. A miss costs 400 ms.
- Fixed clock (Sprint 60 s, Drill 45 s).
- The clock starts on the first keystroke and pauses when the tab is hidden.

`summary()` returns score, WPM, accuracy, level, the elapsed time of every
finished word, and per-letter hit and miss counts. The play component calls
`view(now)` on each animation frame and renders it through signals; it adds
sound, confetti and announcements, and holds no game rules of its own.

## Words

`shared/data/words.ts` holds about 3,100 common English words, 3 to 12
letters. They were pulled once from Datamuse word frequencies (12+ uses per
million), kept only if the macOS system dictionary lists them in lowercase
(which removes names), and passed through a short blocklist.

2.x fetched words from Datamuse at the start of each round. 3.0 dropped that:
samples of the live API returned profanity, rare words ("anserine",
"ataraxis"), and for a six-letter pattern only words starting with a, p or
s. A bundled list also means a run never waits
on the network, the app works offline without a fallback path, and the
privacy policy can say the app makes no requests of its own.

The Daily seeds `levelledSupply` with a hash of the UTC date, so every
player gets the same sequence. Drill ranks words by how many of your
weakest letters they contain (`weakKeys` smooths miss rates so a letter seen
twice does not top the list) and leans picks towards the top of that list.

## Ghost

Each personal best stores the elapsed time at which every word was finished.
During a run, `ghostWordsAt(times, elapsed)` gives how far the best run had
got at the same moment, and the meter shows the difference. Results draw
both runs as step lines in `race-chart`. The Daily keeps one best per date.

## Persistence

`Store` keeps one versioned JSON entry under the `typester` localStorage key:
settings, bests per mode, Daily bests for 60 days, the last 40 runs,
lifetime per-letter tallies, totals and the day streak. Anything unreadable
falls back to defaults. Theme, motion and sound carry over from the 2.x
settings key; 2.x scores do not, because scoring changed. A run with no
finished words does not count towards runs or the streak.

`index.html` reads the theme and motion from the same entry before first
paint, so a dark-mode player never sees the light theme flash.

## Decisions

- **No state library.** Two signal services (`Store`, plus component
  state) cover it.
- **Static prerender, no server.** `outputMode: "static"`. Play routes render
  client-side only (`app.routes.server.ts`).
- **Pure engine.** `engine.ts` and `words.ts` import nothing from Angular and
  are tested with plain Vitest.
- **No UI kit.** Tailwind plus CSS custom properties from the design doc.
- **Synthesized sound.** Each correct letter plays the next note of a C major
  pentatonic scale, an octave up from ×3. No audio files ship.
- **Canvas share card.** Drawn in the browser from the current theme's tokens.
- **Challenge scores are self-reported.** There is no backend to verify a
  `?vs=` score, and the copy never calls it a leaderboard.

## Testing

- Unit (`npm test`): engine rules and clocks, word supplies, Daily
  determinism, weak keys, store round-trips, streaks, settings migration, and
  the play component's input handling.
- E2E (`npx playwright test`, Chromium, WebKit, iPhone 15): hero start,
  number-key mode pick, a full Sprint with a miss and replay, bests on home
  and stats, challenge links, settings persistence, unknown mode redirect.
- Accessibility: axe scans in light and dark on home, challenge landing,
  play, stats, settings, privacy, and the results panel after a real run.
  Zero serious or critical violations required.

## Limits

- No accounts or sync; data stays in one browser.
- English only.
- Phones get the on-screen keyboard through a transparent input over the
  board. When a keyboard delivers several characters in one input event
  (autocomplete, composition), each is still checked in order, but feedback
  arrives per batch. Tested in mobile Safari emulation only, not on devices.
