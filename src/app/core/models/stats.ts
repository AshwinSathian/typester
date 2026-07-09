import { AchievementId } from './achievement';
import { Difficulty } from './difficulty';

export interface BestScoreEntry {
  readonly totalScore: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly achievedAt: string;
}

export interface Stats {
  /** Keyed by gameConfigKey(config) — see game-config.ts. */
  readonly bestScores: Readonly<Record<string, BestScoreEntry>>;
  readonly achievementsUnlocked: readonly AchievementId[];
  readonly roundsPlayed: number;
  readonly totalWordsTyped: number;
  readonly difficultiesBeaten: readonly Difficulty[];
}

export const DEFAULT_STATS: Stats = {
  bestScores: {},
  achievementsUnlocked: [],
  roundsPlayed: 0,
  totalWordsTyped: 0,
  difficultiesBeaten: [],
};
