/**
 * Pure TypeScript game engine — zero Angular imports (see ARCHITECTURE.md §D4).
 * Owns word selection, the idle -> playing -> finished session state machine,
 * scoring (combo multiplier + power words), WPM/accuracy, and achievement
 * evaluation. Angular components/services wrap this reactively via signals;
 * they must not reimplement any of this logic.
 */
import { AchievementId, DAY_STREAK_TIERS, WPM_CLUB_TIERS } from '../models/achievement';
import { DIFFICULTIES, DIFFICULTY_POINTS, Difficulty } from '../models/difficulty';
import { GameConfig, QUICK_PLAY_COMPOSITION } from '../models/game-config';
import { GameResult } from '../models/game-result';
import { Stats } from '../models/stats';
import { WordEntry } from '../models/word';

export type SessionState = 'idle' | 'playing' | 'finished';

export interface WordPools {
  readonly easy: readonly string[];
  readonly medium: readonly string[];
  readonly hard: readonly string[];
}

export interface SessionSnapshot {
  readonly state: SessionState;
  readonly currentWord: WordEntry | null;
  /** The next 1-2 words after currentWord, for the Game screen's word
   *  look-ahead queue - never more than what's actually left in the round. */
  readonly upcomingWords: readonly WordEntry[];
  readonly wordIndex: number;
  readonly totalWords: number;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly multiplier: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  /** Correct characters typed so far this round - the same figure the final
   *  WPM formula divides by elapsed minutes; exposed so the Game screen can
   *  compute a *live* WPM reading without duplicating the formula. */
  readonly correctChars: number;
  /** Mistakes remaining before Endless/Survival mode ends the round; null
   *  for quick/timed sessions, which have no mistake limit. */
  readonly livesRemaining: number | null;
}

export interface SubmitOutcome {
  readonly correct: boolean;
  /** A single-character-edit typo on an otherwise-incorrect submission - a
   *  feedback distinction only, not scoring leniency; the streak still
   *  resets on a near miss exactly as it does on a full miss. */
  readonly nearMiss: boolean;
  readonly finished: boolean;
  readonly snapshot: SessionSnapshot;
}

/** Roughly 1 in 8 words (after the first) is a double-points power word. */
export const POWER_WORD_CHANCE = 0.125;

/** Streak length -> score multiplier. Resets to the base tier on any mistake. */
export function multiplierForStreak(streak: number): number {
  if (streak >= 10) return 2;
  if (streak >= 5) return 1.5;
  return 1;
}

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

/** A near-miss is exactly one character off from the target - close enough
 *  to deserve a distinct (warning, not danger) feedback tier. Case/whitespace
 *  insensitive, same normalization as the exact-match check. */
export function isNearMiss(typed: string, target: string): boolean {
  return levenshteinDistance(normalize(typed), normalize(target)) === 1;
}

/**
 * Per-character diff of a submission against its target word, aligned via
 * an edit-distance backtrace rather than raw index position - so a single
 * dropped or inserted character doesn't cascade into every character after
 * it reading as "wrong" (a naive `typed[i] !== target[i]` compare would
 * flag the entire tail of the word once the strings shift out of phase).
 * Returns one boolean per character of `typed` - true where that character
 * was a substitution or an extra insertion. A deleted (missing) target
 * character has no corresponding typed index, so it can't be flagged this
 * way - the Game screen represents "typed ran short" separately by padding
 * its rendered diff past `typed.length` (see Game.mistypedChars).
 */
export function diffAgainstTarget(typed: string, target: string): readonly boolean[] {
  const a = typed;
  const b = target;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  const wrongByTypedIndex = new Array<boolean>(a.length).fill(false);
  let i = rows - 1;
  let j = cols - 1;
  while (i > 0 || j > 0) {
    const isMatch = i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase();
    // Insertion is checked before a free diagonal match: on a repeated
    // character (e.g. typed "catt" against target "cat"), both a match and
    // an insertion are simultaneously valid at this cell - preferring
    // insertion resolves the tie by flagging the *later* occurrence of the
    // repeated character as the extra one, which reads more intuitively
    // than flagging an earlier, identical character instead.
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      wrongByTypedIndex[i - 1] = true;
      i--;
    } else if (isMatch && dp[i][j] === dp[i - 1][j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // Substitution - the typed character replaced a different target one.
      wrongByTypedIndex[i - 1] = true;
      i--;
      j--;
    } else {
      // Deletion - a target character with no typed counterpart; nothing
      // to flag on the typed side.
      j--;
    }
  }

  return wrongByTypedIndex;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawWithoutReplacement(
  pool: readonly string[],
  count: number,
  rng: () => number,
): string[] {
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

function withPowerWords(words: readonly WordEntry[], rng: () => number): WordEntry[] {
  return words.map((word, i) => ({
    ...word,
    isPowerWord: i > 0 && rng() < POWER_WORD_CHANCE,
  }));
}

/**
 * Stably partitions an already-shuffled word list into a shorter-word half
 * and a longer-word half (median split by character length), then
 * concatenates shorter-first - so a round's second half skews toward
 * longer/rarer words than its first half, without disturbing each half's
 * existing shuffled order. Applied before power-word assignment so "the
 * first word is never a power word" still holds regardless of reordering.
 *
 * This is a static per-round escalation, not a live reaction to the
 * player's current streak - GameSession's word list is built once, upfront,
 * before a session (and therefore a streak) exists to react to. Extending
 * `buildRoundWords` this way avoids reworking GameSession's tested
 * draw-once contract.
 */
export function escalateByLength(words: readonly WordEntry[]): WordEntry[] {
  if (words.length <= 1) return [...words];
  const lengths = words.map((w) => w.text.length).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  const shorter = words.filter((w) => w.text.length <= median);
  const longer = words.filter((w) => w.text.length > median);
  return [...shorter, ...longer];
}

/**
 * Builds the ordered word list for a round: Quick Play uses the fixed
 * 4 easy + 4 medium + 2 hard composition (legacy behavior, preserved
 * deliberately); Timed/Endless mode draws the full pool for the chosen
 * difficulty, without replacement, escalated toward longer words as the
 * round progresses, so a round only ends early if the clock (or the
 * mistake limit) runs out.
 */
export function buildRoundWords(
  config: GameConfig,
  pools: WordPools,
  rng: () => number = Math.random,
): WordEntry[] {
  if (config.mode === 'quick') {
    const entries: WordEntry[] = DIFFICULTIES.flatMap((difficulty) =>
      drawWithoutReplacement(pools[difficulty], QUICK_PLAY_COMPOSITION[difficulty], rng).map(
        (text) => ({ text, difficulty, isPowerWord: false }),
      ),
    );
    return withPowerWords(shuffle(entries, rng), rng);
  }

  const difficulty = config.difficulty as Difficulty;
  const drawn = drawWithoutReplacement(pools[difficulty], pools[difficulty].length, rng);
  const entries = drawn.map((text) => ({ text, difficulty, isPowerWord: false }));
  return withPowerWords(escalateByLength(entries), rng);
}

/** Per-second bonus awarded for finishing the word list before time runs out. */
const TIME_BONUS_POINTS_PER_SECOND = 1;

export class GameSession {
  private readonly words: readonly WordEntry[];
  private index = 0;
  private score = 0;
  private streak = 0;
  private bestStreak = 0;
  private correctCount = 0;
  private incorrectCount = 0;
  private correctChars = 0;
  private state: SessionState = 'idle';
  private startedAtMs = 0;
  private endedAtMs = 0;

  constructor(
    private readonly config: GameConfig,
    words: readonly WordEntry[],
    /** Endless/Survival mode: the round finishes on the Nth incorrect
     *  submission instead of (or in addition to) running out of words.
     *  `null` (the default) preserves the existing unlimited-mistakes
     *  behavior for quick/timed sessions exactly as before. */
    private readonly mistakesAllowed: number | null = null,
  ) {
    if (words.length === 0) {
      throw new Error('GameSession requires at least one word');
    }
    this.words = words;
  }

  start(nowMs: number): SessionSnapshot {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start a session in state "${this.state}"`);
    }
    this.state = 'playing';
    this.startedAtMs = nowMs;
    return this.snapshot();
  }

  submit(input: string, nowMs: number): SubmitOutcome {
    if (this.state !== 'playing') {
      throw new Error(`Cannot submit while session is in state "${this.state}"`);
    }

    const target = this.words[this.index];
    const correct = normalize(input) === normalize(target.text);
    const nearMiss = !correct && isNearMiss(input, target.text);

    if (correct) {
      this.correctCount++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.correctChars += target.text.length;
      const multiplier = multiplierForStreak(this.streak);
      const powerFactor = target.isPowerWord ? 2 : 1;
      this.score += Math.round(DIFFICULTY_POINTS[target.difficulty] * multiplier * powerFactor);
      this.index++;
    } else {
      this.incorrectCount++;
      this.streak = 0;
    }

    const mistakesExhausted =
      this.mistakesAllowed !== null && this.incorrectCount >= this.mistakesAllowed;
    const wordsExhausted = this.index >= this.words.length;
    const finished = wordsExhausted || mistakesExhausted;
    if (finished) {
      this.finish(nowMs);
    }

    return { correct, nearMiss, finished, snapshot: this.snapshot() };
  }

  /** Called by the Angular wrapper's timer when the clock reaches zero. */
  expireTime(nowMs: number): SessionSnapshot {
    if (this.state === 'playing') {
      this.finish(nowMs);
    }
    return this.snapshot();
  }

  private finish(nowMs: number): void {
    this.state = 'finished';
    this.endedAtMs = nowMs;
  }

  snapshot(): SessionSnapshot {
    return {
      state: this.state,
      currentWord: this.index < this.words.length ? this.words[this.index] : null,
      upcomingWords: this.words.slice(this.index + 1, this.index + 3),
      wordIndex: this.index,
      totalWords: this.words.length,
      score: this.score,
      streak: this.streak,
      bestStreak: this.bestStreak,
      multiplier: multiplierForStreak(this.streak),
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      correctChars: this.correctChars,
      livesRemaining:
        this.mistakesAllowed === null
          ? null
          : Math.max(0, this.mistakesAllowed - this.incorrectCount),
    };
  }

  result(): GameResult {
    if (this.state !== 'finished') {
      throw new Error('Cannot read a result before the session has finished');
    }

    const elapsedMs = this.endedAtMs - this.startedAtMs;
    const minutesElapsed = elapsedMs / 60_000;
    const wpm = minutesElapsed > 0 ? Math.round(this.correctChars / 5 / minutesElapsed) : 0;

    const attempts = this.correctCount + this.incorrectCount;
    const accuracy = attempts > 0 ? this.correctCount / attempts : 0;

    // Endless/Survival reuses config.durationSeconds to mean "lives", not
    // seconds (see the constructor's mistakesAllowed param) - it has no
    // clock, so it can never earn a time bonus regardless of how the round
    // ended. Gating on mistakesAllowed === null (rather than re-deriving
    // config.mode !== 'endless') ties this directly to the same signal that
    // already distinguishes "this session has a real clock".
    const hasClock = this.mistakesAllowed === null;
    const exhausted = this.index >= this.words.length;
    const remainingMs = hasClock ? Math.max(0, this.config.durationSeconds * 1000 - elapsedMs) : 0;
    const timeBonus =
      exhausted && hasClock ? Math.floor((remainingMs / 1000) * TIME_BONUS_POINTS_PER_SECOND) : 0;

    return {
      config: this.config,
      wordsCorrect: this.correctCount,
      wordsIncorrect: this.incorrectCount,
      baseScore: this.score,
      timeBonus,
      totalScore: this.score + timeBonus,
      wpm,
      accuracy,
      bestStreak: this.bestStreak,
      achievementsUnlocked: [],
      finishedAt: new Date(this.endedAtMs).toISOString(),
    };
  }
}

/**
 * Evaluates which achievements a finished round newly unlocks, given the
 * player's stats from *before* this round (plus the freshly-computed day
 * streak, since that's derived from this same result but isn't part of
 * priorStats yet - StorageService computes it first and passes it in).
 * Pure and side-effect free — StorageService is responsible for persisting
 * the merged result.
 */
export function evaluateAchievements(
  result: GameResult,
  priorStats: Stats,
  currentDayStreak: number = priorStats.dayStreak,
): AchievementId[] {
  const already = new Set(priorStats.achievementsUnlocked);
  const unlocked = new Set<AchievementId>();

  if (priorStats.roundsPlayed === 0) {
    unlocked.add('first-round');
  }
  for (const tier of WPM_CLUB_TIERS) {
    if (result.wpm >= tier) {
      unlocked.add(`wpm-${tier}` as AchievementId);
    }
  }
  if (result.accuracy >= 1 && result.wordsCorrect > 0) {
    unlocked.add('perfect-accuracy');
  }
  if (result.bestStreak >= 10) {
    unlocked.add('streak-10');
  }
  for (const tier of DAY_STREAK_TIERS) {
    if (currentDayStreak >= tier) {
      unlocked.add(`streak-day-${tier}` as AchievementId);
    }
  }

  if (result.config.mode === 'timed') {
    const difficultiesBeaten = new Set(priorStats.difficultiesBeaten);
    difficultiesBeaten.add(result.config.difficulty as Difficulty);
    if (DIFFICULTIES.every((difficulty) => difficultiesBeaten.has(difficulty))) {
      unlocked.add('all-difficulties');
    }
  }

  return [...unlocked].filter((id) => !already.has(id));
}

/** A single not-yet-unlocked achievement's numeric gap, for the Results
 *  screen's "closest miss" line. */
export interface AchievementProgress {
  readonly id: AchievementId;
  readonly label: string;
  readonly remaining: number;
  readonly unit: string;
}

function achievementProgress(
  result: GameResult,
  priorStats: Stats,
  currentDayStreak: number,
): AchievementProgress[] {
  const already = new Set(priorStats.achievementsUnlocked);
  const progress: AchievementProgress[] = [];

  for (const tier of WPM_CLUB_TIERS) {
    const id = `wpm-${tier}` as AchievementId;
    if (!already.has(id) && result.wpm < tier) {
      progress.push({ id, label: `${tier} WPM Club`, remaining: tier - result.wpm, unit: 'WPM' });
    }
  }
  if (!already.has('streak-10') && result.bestStreak < 10) {
    progress.push({
      id: 'streak-10',
      label: '10-Streak',
      remaining: 10 - result.bestStreak,
      unit: 'in a row',
    });
  }
  for (const tier of DAY_STREAK_TIERS) {
    const id = `streak-day-${tier}` as AchievementId;
    if (!already.has(id) && currentDayStreak < tier) {
      progress.push({
        id,
        label: `${tier}-Day Streak`,
        remaining: tier - currentDayStreak,
        unit: 'days',
      });
    }
  }

  return progress;
}

/**
 * The single closest not-yet-unlocked achievement this round, as a
 * human-readable line ("6 more WPM for the 50 WPM Club"). Returns null once
 * there's nothing left computable to be close to, or when this round
 * already unlocked something (the caller should prefer showing that instead
 * — see Results.unlockedAchievements()).
 */
export function closestAchievementMiss(
  result: GameResult,
  priorStats: Stats,
  currentDayStreak: number = priorStats.dayStreak,
): string | null {
  const progress = achievementProgress(result, priorStats, currentDayStreak);
  if (progress.length === 0) return null;

  const closest = progress.reduce((a, b) => (b.remaining < a.remaining ? b : a));
  if (closest.remaining <= 0) return null;

  return `${closest.remaining} more ${closest.unit} for the ${closest.label}`;
}
