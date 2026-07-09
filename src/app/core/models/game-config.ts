import { DIFFICULTIES, Difficulty } from './difficulty';
import { Stats } from './stats';

export type GameMode = 'quick' | 'timed';

/** Route-param difficulty: 'mixed' is only valid for quick mode. */
export type RouteDifficulty = Difficulty | 'mixed';

export const GAME_DURATIONS = [30, 60, 120] as const;
export type GameDuration = (typeof GAME_DURATIONS)[number];

export const QUICK_PLAY_DURATION_SECONDS = 90;

/** Fixed word composition for Quick Play (legacy behavior, preserved deliberately). */
export const QUICK_PLAY_COMPOSITION: Readonly<Record<Difficulty, number>> = {
  easy: 4,
  medium: 4,
  hard: 2,
};

export interface GameConfig {
  readonly mode: GameMode;
  readonly difficulty: RouteDifficulty;
  readonly durationSeconds: number;
}

/** Stable key used by StorageService to track best scores per exact config. */
export function gameConfigKey(config: GameConfig): string {
  return `${config.mode}:${config.difficulty}:${config.durationSeconds}`;
}

const VALID_DIFFICULTIES = new Set<string>(['easy', 'medium', 'hard']);
const VALID_DURATIONS = new Set<number>(GAME_DURATIONS);

export function isValidGameConfig(mode: string, difficulty: string, duration: string): boolean {
  const durationNum = Number(duration);

  if (mode === 'quick') {
    return difficulty === 'mixed' && durationNum === QUICK_PLAY_DURATION_SECONDS;
  }

  if (mode === 'timed') {
    return VALID_DIFFICULTIES.has(difficulty) && VALID_DURATIONS.has(durationNum);
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
 *  both iterate (PLAN-typester-growth.md Phase 7). */
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
 * The next not-yet-beaten combo after `current` in the fixed 10-combo
 * order (wrapping around), for Results' cross-promotion action. Returns
 * null once every combo already has a best score - never suggests one
 * already beaten (DESIGN §Results screen rework: Next-combo
 * cross-promotion).
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
