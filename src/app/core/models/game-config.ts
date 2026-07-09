import { Difficulty } from './difficulty';

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
