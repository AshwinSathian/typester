/**
 * The game, as plain TypeScript. No Angular imports: components feed it
 * keystrokes and timestamps and render whatever `view()` returns.
 *
 * One rule drives everything: every keystroke is either the next letter
 * (a hit) or it isn't (a miss). A miss never enters the word, so there is
 * nothing to backspace. Finishing the last letter completes the word.
 */

export type ModeId = 'rush' | 'sprint' | 'daily' | 'drill';

export interface Rules {
  /** `bank`: the clock starts at `seconds` and every word buys more time.
   *  `fixed`: the clock runs for exactly `seconds`. */
  readonly clock: 'bank' | 'fixed';
  readonly seconds: number;
}

export const RULES: Readonly<Record<ModeId, Rules>> = {
  rush: { clock: 'bank', seconds: 15 },
  daily: { clock: 'bank', seconds: 15 },
  sprint: { clock: 'fixed', seconds: 60 },
  drill: { clock: 'fixed', seconds: 45 },
};

export interface Word {
  readonly text: string;
  /** Gold words score double and, in a bank mode, buy extra time. */
  readonly gold: boolean;
}

/** Returns the word at a given position in the run. Must be deterministic
 *  for the Daily, so it takes the index rather than keeping its own count. */
export type WordSupply = (index: number) => Word;

export const WORDS_PER_LEVEL = 6;
/** The bank can never hold more than this, so a strong start can't coast. */
export const BANK_CAP_MS = 30_000;
export const MISS_PENALTY_MS = 400;
/** Clean keystrokes needed for each multiplier step: x1, x2, x3, x4, x5. */
export const COMBO_STEPS = [0, 20, 50, 100, 180] as const;
const QUEUE_LENGTH = 4;

export function levelFor(wordsDone: number): number {
  return 1 + Math.floor(wordsDone / WORDS_PER_LEVEL);
}

export function multiplierFor(combo: number): number {
  let tier = 0;
  for (let i = 0; i < COMBO_STEPS.length; i++) {
    if (combo >= COMBO_STEPS[i]) tier = i;
  }
  return tier + 1;
}

/** Time a completed word adds to the bank. Shrinks 12% per level, so even
 *  the fastest typist eventually runs dry. */
export function bonusMsFor(word: Word, level: number): number {
  const perLetter = 520 * Math.pow(0.88, level - 1);
  return Math.round(word.text.length * perLetter * (word.gold ? 1.5 : 1));
}

/** Words per minute, counting a word as five characters and crediting one
 *  space per finished word, the usual convention. */
export function wpm(chars: number, words: number, elapsedMs: number): number {
  if (elapsedMs < 1000) return 0;
  return Math.round((chars + words) / 5 / (elapsedMs / 60_000));
}

/** How many words a past run had finished at `elapsedMs`. */
export function ghostWordsAt(times: readonly number[], elapsedMs: number): number {
  let n = 0;
  while (n < times.length && times[n] <= elapsedMs) n++;
  return n;
}

export type Press =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'hit'; readonly multiplierUp: boolean }
  | {
      readonly kind: 'word';
      readonly word: Word;
      readonly points: number;
      readonly bonusMs: number;
      readonly levelUp: boolean;
      readonly multiplierUp: boolean;
    }
  | { readonly kind: 'miss'; readonly expected: string; readonly multiplierLost: boolean };

export type Status = 'ready' | 'running' | 'paused' | 'over';

export interface View {
  readonly status: Status;
  readonly queue: readonly Word[];
  /** Letters of `queue[0]` already typed. */
  readonly typed: number;
  readonly score: number;
  readonly combo: number;
  readonly multiplier: number;
  readonly level: number;
  readonly wordsDone: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly wpm: number;
}

export interface Summary {
  readonly score: number;
  readonly wpm: number;
  /** 0 to 100, one decimal. */
  readonly accuracy: number;
  readonly level: number;
  readonly words: number;
  readonly bestCombo: number;
  readonly durationMs: number;
  /** Elapsed ms at which each word was finished: the ghost and WPM graph. */
  readonly wordTimes: readonly number[];
  readonly hits: Readonly<Record<string, number>>;
  readonly misses: Readonly<Record<string, number>>;
}

export class Run {
  private status: Status = 'ready';
  private readonly queue: Word[] = [];
  private nextIndex = 0;
  private typed = 0;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private wordsDone = 0;
  private chars = 0;
  private hitCount = 0;
  private missCount = 0;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedMs = 0;
  /** Bank modes: the elapsed time at which the run ends. */
  private endsAtMs: number;
  private finalElapsedMs = 0;
  private readonly wordTimes: number[] = [];
  private readonly hits: Record<string, number> = {};
  private readonly misses: Record<string, number> = {};

  constructor(
    private readonly rules: Rules,
    private readonly supply: WordSupply,
  ) {
    this.endsAtMs = rules.seconds * 1000;
    while (this.queue.length < QUEUE_LENGTH) this.queue.push(this.supply(this.nextIndex++));
  }

  /** Feed one typed character. The first keystroke starts the clock. */
  press(char: string, now: number): Press {
    if (this.status === 'over' || char.length !== 1 || char === ' ') return { kind: 'ignored' };
    if (this.status === 'paused') this.resume(now);
    if (this.status === 'ready') {
      this.status = 'running';
      this.startedAt = now;
    }
    if (this.tick(now)) return { kind: 'ignored' };

    const word = this.queue[0];
    const expected = word.text[this.typed];
    const before = multiplierFor(this.combo);

    if (char.toLowerCase() !== expected) {
      this.missCount++;
      this.misses[expected] = (this.misses[expected] ?? 0) + 1;
      this.combo = 0;
      if (this.rules.clock === 'bank') this.endsAtMs -= MISS_PENALTY_MS;
      this.tick(now);
      return { kind: 'miss', expected, multiplierLost: before > 1 };
    }

    this.hitCount++;
    this.hits[expected] = (this.hits[expected] ?? 0) + 1;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.typed++;
    const multiplierUp = multiplierFor(this.combo) > before;

    if (this.typed < word.text.length) return { kind: 'hit', multiplierUp };

    const level = levelFor(this.wordsDone);
    const points = word.text.length * 10 * multiplierFor(this.combo) * (word.gold ? 2 : 1);
    let bonusMs = 0;
    if (this.rules.clock === 'bank') {
      const room = BANK_CAP_MS - this.remaining(now);
      bonusMs = Math.max(0, Math.min(bonusMsFor(word, level), room));
      this.endsAtMs += bonusMs;
    }
    this.score += points;
    this.wordsDone++;
    this.chars += word.text.length;
    this.wordTimes.push(Math.round(this.elapsed(now)));
    this.typed = 0;
    this.queue.shift();
    this.queue.push(this.supply(this.nextIndex++));

    return {
      kind: 'word',
      word,
      points,
      bonusMs,
      levelUp: levelFor(this.wordsDone) > level,
      multiplierUp,
    };
  }

  /** Advance the clock. Returns true once the run is over. */
  tick(now: number): boolean {
    if (this.status === 'running' && this.remaining(now) <= 0) {
      this.finalElapsedMs = this.endsAtMs;
      this.status = 'over';
    }
    return this.status === 'over';
  }

  pause(now: number): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.pausedAt = now;
  }

  resume(now: number): void {
    if (this.status !== 'paused') return;
    this.pausedMs += now - this.pausedAt;
    this.status = 'running';
  }

  /** End early: the player quit, but the score so far still counts. */
  end(now: number): void {
    if (this.status === 'over') return;
    this.finalElapsedMs = this.elapsed(now);
    this.status = 'over';
  }

  elapsed(now: number): number {
    switch (this.status) {
      case 'ready':
        return 0;
      case 'over':
        return this.finalElapsedMs;
      case 'paused':
        return this.pausedAt - this.startedAt - this.pausedMs;
      case 'running':
        return now - this.startedAt - this.pausedMs;
    }
  }

  remaining(now: number): number {
    return Math.max(0, this.endsAtMs - this.elapsed(now));
  }

  view(now: number): View {
    const elapsedMs = this.elapsed(now);
    return {
      status: this.status,
      queue: [...this.queue],
      typed: this.typed,
      score: this.score,
      combo: this.combo,
      multiplier: multiplierFor(this.combo),
      level: levelFor(this.wordsDone),
      wordsDone: this.wordsDone,
      elapsedMs,
      remainingMs: this.remaining(now),
      wpm: wpm(this.chars, this.wordsDone, elapsedMs),
    };
  }

  summary(): Summary {
    const total = this.hitCount + this.missCount;
    return {
      score: this.score,
      wpm: wpm(this.chars, this.wordsDone, this.finalElapsedMs),
      accuracy: total === 0 ? 0 : Math.round((this.hitCount / total) * 1000) / 10,
      level: levelFor(this.wordsDone),
      words: this.wordsDone,
      bestCombo: this.bestCombo,
      durationMs: this.finalElapsedMs,
      wordTimes: [...this.wordTimes],
      hits: { ...this.hits },
      misses: { ...this.misses },
    };
  }
}
