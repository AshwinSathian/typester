/**
 * Pure TypeScript game engine — zero Angular imports (see PLAN-typester.md D4).
 * Owns word selection, the idle -> playing -> finished session state machine,
 * scoring (combo multiplier + power words), WPM/accuracy, and achievement
 * evaluation. Angular components/services wrap this reactively via signals;
 * they must not reimplement any of this logic.
 */
import { AchievementId } from '../models/achievement';
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
  readonly wordIndex: number;
  readonly totalWords: number;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly multiplier: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
}

export interface SubmitOutcome {
  readonly correct: boolean;
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
 * Builds the ordered word list for a round: Quick Play uses the fixed
 * 4 easy + 4 medium + 2 hard composition (legacy behavior, preserved
 * deliberately); Timed mode draws the full pool for the chosen difficulty,
 * without replacement, so a round only ends early if the clock runs out.
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
  return withPowerWords(
    drawn.map((text) => ({ text, difficulty, isPowerWord: false })),
    rng,
  );
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

    const exhausted = this.index >= this.words.length;
    if (exhausted) {
      this.finish(nowMs);
    }

    return { correct, finished: exhausted, snapshot: this.snapshot() };
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
      wordIndex: this.index,
      totalWords: this.words.length,
      score: this.score,
      streak: this.streak,
      bestStreak: this.bestStreak,
      multiplier: multiplierForStreak(this.streak),
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
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

    const exhausted = this.index >= this.words.length;
    const remainingMs = Math.max(0, this.config.durationSeconds * 1000 - elapsedMs);
    const timeBonus = exhausted
      ? Math.floor((remainingMs / 1000) * TIME_BONUS_POINTS_PER_SECOND)
      : 0;

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
 * player's stats from *before* this round. Pure and side-effect free —
 * StorageService is responsible for persisting the merged result.
 */
export function evaluateAchievements(result: GameResult, priorStats: Stats): AchievementId[] {
  const already = new Set(priorStats.achievementsUnlocked);
  const unlocked = new Set<AchievementId>();

  if (priorStats.roundsPlayed === 0) {
    unlocked.add('first-round');
  }
  if (result.wpm >= 50) {
    unlocked.add('wpm-50');
  }
  if (result.accuracy >= 1 && result.wordsCorrect > 0) {
    unlocked.add('perfect-accuracy');
  }
  if (result.bestStreak >= 10) {
    unlocked.add('streak-10');
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
