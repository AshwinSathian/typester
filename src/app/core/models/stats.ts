import { AchievementId } from './achievement';
import { Difficulty } from './difficulty';

export interface BestScoreEntry {
  readonly totalScore: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly achievedAt: string;
}

export interface DailyResultEntry {
  readonly totalScore: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly achievedAt: string;
  readonly dayNumber: number;
}

export interface Stats {
  /** Keyed by gameConfigKey(config) — see game-config.ts. */
  readonly bestScores: Readonly<Record<string, BestScoreEntry>>;
  /**
   * Keyed by UTC `YYYY-MM-DD` — deliberately never the same bucket as
   * bestScores; a daily-challenge result has its own distinct, collectible
   * identity.
   */
  readonly dailyResults: Readonly<Record<string, DailyResultEntry>>;
  readonly achievementsUnlocked: readonly AchievementId[];
  readonly roundsPlayed: number;
  readonly totalWordsTyped: number;
  readonly difficultiesBeaten: readonly Difficulty[];
  /** Consecutive calendar days (UTC) with at least one finished round. */
  readonly dayStreak: number;
  /** UTC `YYYY-MM-DD` of the last finished round — the streak's anchor date. */
  readonly lastPlayedDate: string | null;
  /** Earned one per 7-day streak; forgives exactly one missed day each. */
  readonly streakFreezeCount: number;
}

export const DEFAULT_STATS: Stats = {
  bestScores: {},
  dailyResults: {},
  achievementsUnlocked: [],
  roundsPlayed: 0,
  totalWordsTyped: 0,
  difficultiesBeaten: [],
  dayStreak: 0,
  lastPlayedDate: null,
  streakFreezeCount: 0,
};

export type StreakStatus = 'none' | 'safe' | 'at-risk' | 'freeze-will-cover';

/**
 * Pure classification of "how urgent is it to play today" for the Home
 * screen's streak banner.
 */
export function streakStatus(stats: Stats, todayUtc: string): StreakStatus {
  if (stats.dayStreak <= 0 || !stats.lastPlayedDate) return 'none';
  if (stats.lastPlayedDate === todayUtc) return 'safe';

  const yesterday = addUtcDaysLocal(todayUtc, -1);
  const twoDaysAgo = addUtcDaysLocal(todayUtc, -2);

  if (stats.lastPlayedDate === yesterday) return 'at-risk';
  if (stats.lastPlayedDate === twoDaysAgo && stats.streakFreezeCount > 0)
    return 'freeze-will-cover';
  return 'none';
}

/** Local, dependency-free day-math so this file needs no import from
 *  daily-challenge.ts (kept separate: that file is challenge-specific,
 *  this one is a general Stats concern). */
function addUtcDaysLocal(dateUtc: string, days: number): string {
  const d = new Date(`${dateUtc}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
