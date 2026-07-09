import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import { AchievementId } from '../models/achievement';
import { DailyChallenge } from '../models/daily-challenge';
import { Difficulty } from '../models/difficulty';
import { gameConfigKey } from '../models/game-config';
import { GameResult } from '../models/game-result';
import { DEFAULT_SETTINGS, MotionPreference, Settings, ThemePreference } from '../models/settings';
import { BestScoreEntry, DEFAULT_STATS, DailyResultEntry, Stats } from '../models/stats';
import { evaluateAchievements } from './game-engine';

/**
 * Bumping this splits old and new data onto different keys, so a future
 * incompatible schema change can never hand malformed data to the new
 * shape's reader — it just falls back to defaults instead of throwing.
 */
const SCHEMA_VERSION = 1;
const SETTINGS_KEY = `typester:v${SCHEMA_VERSION}:settings`;
const STATS_KEY = `typester:v${SCHEMA_VERSION}:stats`;

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const MOTIONS: readonly MotionPreference[] = ['system', 'reduced', 'full'];

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    THEMES.includes(v['theme'] as ThemePreference) &&
    typeof v['soundEnabled'] === 'boolean' &&
    MOTIONS.includes(v['motion'] as MotionPreference) &&
    typeof v['quickPlayDurationSeconds'] === 'number' &&
    v['quickPlayDurationSeconds'] >= 15 &&
    v['quickPlayDurationSeconds'] <= 300 &&
    typeof v['localStorageNoticeDismissed'] === 'boolean'
  );
}

function isBestScoreEntry(value: unknown): value is BestScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['totalScore'] === 'number' &&
    typeof v['wpm'] === 'number' &&
    typeof v['accuracy'] === 'number' &&
    typeof v['achievedAt'] === 'string'
  );
}

function isStats(value: unknown): value is Stats {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['bestScores'] === 'object' &&
    v['bestScores'] !== null &&
    Object.values(v['bestScores'] as Record<string, unknown>).every(isBestScoreEntry) &&
    Array.isArray(v['achievementsUnlocked']) &&
    typeof v['roundsPlayed'] === 'number' &&
    typeof v['totalWordsTyped'] === 'number' &&
    Array.isArray(v['difficultiesBeaten'])
  );
}

/**
 * dayStreak/lastPlayedDate/dailyResults/streakFreezeCount were all added
 * after this app went live, so stored data from before those changes won't
 * have them - defaulted here rather than added to isStats's requirements,
 * so a returning user's existing bestScores/achievements aren't wiped just
 * because the schema grew a field.
 */
function normalizeStats(value: Stats): Stats {
  return {
    ...value,
    dailyResults: value.dailyResults ?? {},
    dayStreak: value.dayStreak ?? 0,
    lastPlayedDate: value.lastPlayedDate ?? null,
    streakFreezeCount: value.streakFreezeCount ?? 0,
  };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBeforeIso(iso: string, days: number): string {
  return dateKey(new Date(new Date(iso).getTime() - days * 86_400_000).toISOString());
}

/** Awards one freeze token every time the streak crosses a multiple of 7 -
 *  scarce and earned by design, never unlimited (PLAN-typester-growth.md
 *  §Risks: an unlimited freeze removes the loss aversion the mechanic
 *  exists to create). */
function awardFreezeIfEarned(freezeCount: number, dayStreak: number): number {
  return dayStreak > 0 && dayStreak % 7 === 0 ? freezeCount + 1 : freezeCount;
}

interface DayStreakUpdate {
  readonly dayStreak: number;
  readonly lastPlayedDate: string;
  readonly streakFreezeCount: number;
  readonly freezeConsumed: boolean;
}

function nextDayStreak(prior: Stats, finishedAtIso: string): DayStreakUpdate {
  const today = dateKey(finishedAtIso);
  if (prior.lastPlayedDate === today) {
    return {
      dayStreak: prior.dayStreak,
      lastPlayedDate: today,
      streakFreezeCount: prior.streakFreezeCount,
      freezeConsumed: false,
    };
  }

  const yesterday = daysBeforeIso(finishedAtIso, 1);
  if (prior.lastPlayedDate === yesterday) {
    const dayStreak = prior.dayStreak + 1;
    return {
      dayStreak,
      lastPlayedDate: today,
      streakFreezeCount: awardFreezeIfEarned(prior.streakFreezeCount, dayStreak),
      freezeConsumed: false,
    };
  }

  // A single missed day, forgiven by a freeze token if one is available -
  // the streak continues exactly as if the gap hadn't happened, but the
  // token is spent (exactly one gap forgiven, never more).
  const twoDaysAgo = daysBeforeIso(finishedAtIso, 2);
  if (prior.lastPlayedDate === twoDaysAgo && prior.streakFreezeCount > 0) {
    const dayStreak = prior.dayStreak + 1;
    return {
      dayStreak,
      lastPlayedDate: today,
      streakFreezeCount: awardFreezeIfEarned(prior.streakFreezeCount - 1, dayStreak),
      freezeConsumed: true,
    };
  }

  return {
    dayStreak: 1,
    lastPlayedDate: today,
    streakFreezeCount: prior.streakFreezeCount,
    freezeConsumed: false,
  };
}

export interface RecordResultOutcome {
  readonly stats: Stats;
  readonly achievementsUnlocked: readonly AchievementId[];
  readonly isNewBest: boolean;
  readonly freezeConsumed: boolean;
}

/**
 * Versioned localStorage wrapper for settings and stats. Falls back to
 * defaults on missing/corrupted/incompatible data rather than throwing, and
 * reconciles state written by another tab via the `storage` event so two
 * simultaneous sessions can't silently clobber each other's best scores.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly settings = signal<Settings>(this.read(SETTINGS_KEY, isSettings, DEFAULT_SETTINGS));
  readonly stats = signal<Stats>(normalizeStats(this.read(STATS_KEY, isStats, DEFAULT_STATS)));

  constructor() {
    if (this.isBrowser) {
      window.addEventListener('storage', (event) => this.onStorageEvent(event));
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    const next: Settings = { ...this.settings(), ...patch };
    this.settings.set(next);
    this.write(SETTINGS_KEY, next);
  }

  recordResult(result: GameResult): RecordResultOutcome {
    const prior = this.stats();
    const dayStreakUpdate = nextDayStreak(prior, result.finishedAt);
    const achievementsUnlocked = evaluateAchievements(result, prior, dayStreakUpdate.dayStreak);

    const key = gameConfigKey(result.config);
    const existingBest = prior.bestScores[key];
    const isNewBest = !existingBest || result.totalScore > existingBest.totalScore;
    const bestScores = isNewBest
      ? {
          ...prior.bestScores,
          [key]: {
            totalScore: result.totalScore,
            wpm: result.wpm,
            accuracy: result.accuracy,
            achievedAt: result.finishedAt,
          },
        }
      : prior.bestScores;

    const difficultiesBeaten: readonly Difficulty[] =
      result.config.mode === 'timed'
        ? [...new Set([...prior.difficultiesBeaten, result.config.difficulty as Difficulty])]
        : prior.difficultiesBeaten;

    const { freezeConsumed, ...dayStreakFields } = dayStreakUpdate;
    const next: Stats = {
      ...prior,
      bestScores,
      achievementsUnlocked: [...prior.achievementsUnlocked, ...achievementsUnlocked],
      roundsPlayed: prior.roundsPlayed + 1,
      totalWordsTyped: prior.totalWordsTyped + result.wordsCorrect,
      difficultiesBeaten,
      ...dayStreakFields,
    };

    this.stats.set(next);
    this.write(STATS_KEY, next);
    return { stats: next, achievementsUnlocked, isNewBest, freezeConsumed };
  }

  /**
   * Same round bookkeeping as recordResult (day streak, rounds played,
   * words typed, achievements), but the score writes into its own
   * dailyResults[date] bucket, never bestScores - a daily-challenge result
   * never competes with (or gets conflated with) a manually-picked config's
   * best score (PLAN-typester-growth.md Phase 6).
   */
  recordDailyResult(challenge: DailyChallenge, result: GameResult): RecordResultOutcome {
    const prior = this.stats();
    const dayStreakUpdate = nextDayStreak(prior, result.finishedAt);
    const achievementsUnlocked = evaluateAchievements(result, prior, dayStreakUpdate.dayStreak);

    const existing = prior.dailyResults[challenge.date];
    const isNewBest = !existing || result.totalScore > existing.totalScore;
    const entry: DailyResultEntry = {
      totalScore: isNewBest ? result.totalScore : existing.totalScore,
      wpm: isNewBest ? result.wpm : existing.wpm,
      accuracy: isNewBest ? result.accuracy : existing.accuracy,
      achievedAt: isNewBest ? result.finishedAt : existing.achievedAt,
      dayNumber: challenge.dayNumber,
    };

    const { freezeConsumed, ...dayStreakFields } = dayStreakUpdate;
    const next: Stats = {
      ...prior,
      dailyResults: { ...prior.dailyResults, [challenge.date]: entry },
      achievementsUnlocked: [...prior.achievementsUnlocked, ...achievementsUnlocked],
      roundsPlayed: prior.roundsPlayed + 1,
      totalWordsTyped: prior.totalWordsTyped + result.wordsCorrect,
      ...dayStreakFields,
    };

    this.stats.set(next);
    this.write(STATS_KEY, next);
    return { stats: next, achievementsUnlocked, isNewBest, freezeConsumed };
  }

  private onStorageEvent(event: StorageEvent): void {
    if (event.key === STATS_KEY) {
      this.stats.set(normalizeStats(this.read(STATS_KEY, isStats, DEFAULT_STATS)));
    } else if (event.key === SETTINGS_KEY) {
      this.settings.set(this.read(SETTINGS_KEY, isSettings, DEFAULT_SETTINGS));
    }
  }

  private read<T>(key: string, guard: (value: unknown) => value is T, fallback: T): T {
    if (!this.isBrowser) return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed: unknown = JSON.parse(raw);
      return guard(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  private write<T>(key: string, value: T): void {
    if (!this.isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (e.g. Safari private mode) - in-memory
      // signal still holds the value for the rest of this session.
    }
  }
}
