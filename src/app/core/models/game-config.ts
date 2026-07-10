import { DIFFICULTIES, Difficulty } from './difficulty';
import { Stats } from './stats';

export type GameMode = 'quick' | 'timed' | 'endless';

/** Route-param difficulty: 'mixed' is only valid for quick mode. */
export type RouteDifficulty = Difficulty | 'mixed';

export const GAME_DURATIONS = [30, 60, 120] as const;
export type GameDuration = (typeof GAME_DURATIONS)[number];

export const QUICK_PLAY_DURATION_SECONDS = 90;

/** "Lives" choices for Endless/Survival mode - the round ends on the Nth
 *  mistake instead of a clock. Reuses the same route segment/GameConfig
 *  field a timed round uses for seconds (see GameConfig.durationSeconds). */
export const ENDLESS_MISTAKE_OPTIONS = [3, 5, 10] as const;

/** Fixed word composition for Quick Play (legacy behavior, preserved deliberately). */
export const QUICK_PLAY_COMPOSITION: Readonly<Record<Difficulty, number>> = {
  easy: 4,
  medium: 4,
  hard: 2,
};

export interface GameConfig {
  readonly mode: GameMode;
  readonly difficulty: RouteDifficulty;
  /** Seconds for quick/timed mode; mistakes-allowed ("lives") for endless
   *  mode - reused rather than adding an endless-only field, since exactly
   *  one of the two meanings ever applies for a given `mode`. */
  readonly durationSeconds: number;
}

/** Stable key used by StorageService to track best scores per exact config. */
export function gameConfigKey(config: GameConfig): string {
  return `${config.mode}:${config.difficulty}:${config.durationSeconds}`;
}

const VALID_DIFFICULTIES = new Set<string>(['easy', 'medium', 'hard']);
const VALID_DURATIONS = new Set<number>(GAME_DURATIONS);
const VALID_ENDLESS_LIVES = new Set<number>(ENDLESS_MISTAKE_OPTIONS);

/** Matches the min/max enforced on the Quick Play duration field in Settings. */
const QUICK_PLAY_DURATION_MIN_SECONDS = 15;
const QUICK_PLAY_DURATION_MAX_SECONDS = 300;

export function isValidGameConfig(mode: string, difficulty: string, duration: string): boolean {
  const durationNum = Number(duration);

  if (mode === 'quick') {
    return (
      difficulty === 'mixed' &&
      Number.isInteger(durationNum) &&
      durationNum >= QUICK_PLAY_DURATION_MIN_SECONDS &&
      durationNum <= QUICK_PLAY_DURATION_MAX_SECONDS
    );
  }

  if (mode === 'timed') {
    return VALID_DIFFICULTIES.has(difficulty) && VALID_DURATIONS.has(durationNum);
  }

  if (mode === 'endless') {
    return VALID_DIFFICULTIES.has(difficulty) && VALID_ENDLESS_LIVES.has(durationNum);
  }

  return false;
}

export interface ComboDescriptor {
  readonly config: GameConfig;
  readonly key: string;
  readonly label: string;
}

/** The fixed 10-combo set (1 Quick Play + 3 difficulties × 3 durations) the
 *  Stats screen's best-scores grid and Results' next-combo cross-promotion
 *  both iterate. */
export function allGameCombos(): readonly ComboDescriptor[] {
  const quick: GameConfig = {
    mode: 'quick',
    difficulty: 'mixed',
    durationSeconds: QUICK_PLAY_DURATION_SECONDS,
  };
  const combos: ComboDescriptor[] = [
    { config: quick, key: gameConfigKey(quick), label: 'Quick Play' },
  ];

  for (const difficulty of DIFFICULTIES) {
    for (const duration of GAME_DURATIONS) {
      const config: GameConfig = { mode: 'timed', difficulty, durationSeconds: duration };
      const label = `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} · ${duration}s`;
      combos.push({ config, key: gameConfigKey(config), label });
    }
  }

  return combos;
}

/**
 * Endless/Survival's own 9-combo set (3 difficulties x 3 lives counts).
 * Endless results are keyed into the same Stats.bestScores table as
 * Quick/Timed (gameConfigKey doesn't distinguish tables), but are
 * deliberately left out of allGameCombos()'s fixed 10-combo set - Results'
 * next-combo cross-promotion is scoped to Quick+Timed only. Without this,
 * an Endless best score had no page where a player could see it again once
 * earned, violating DESIGN.md's "every stat gets a place to be seen twice"
 * principle - the Stats screen renders this as its own section.
 */
export function allEndlessCombos(): readonly ComboDescriptor[] {
  const combos: ComboDescriptor[] = [];

  for (const difficulty of DIFFICULTIES) {
    for (const lives of ENDLESS_MISTAKE_OPTIONS) {
      const config: GameConfig = { mode: 'endless', difficulty, durationSeconds: lives };
      const label = `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)} · ${lives} lives`;
      combos.push({ config, key: gameConfigKey(config), label });
    }
  }

  return combos;
}

/**
 * The next not-yet-beaten combo after `current` in the fixed 10-combo
 * order (wrapping around), for Results' cross-promotion action. Returns
 * null once every combo already has a best score - never suggests one
 * already beaten.
 */
export function nextUnbeatenCombo(stats: Stats, current: GameConfig): ComboDescriptor | null {
  const combos = allGameCombos();
  const currentKey = gameConfigKey(current);
  const currentIndex = combos.findIndex((combo) => combo.key === currentKey);
  const ordered =
    currentIndex === -1
      ? combos
      : [...combos.slice(currentIndex + 1), ...combos.slice(0, currentIndex + 1)];

  return ordered.find((combo) => combo.key !== currentKey && !stats.bestScores[combo.key]) ?? null;
}
