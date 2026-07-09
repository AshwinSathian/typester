import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import { AchievementId } from '../models/achievement';
import { Difficulty } from '../models/difficulty';
import { gameConfigKey } from '../models/game-config';
import { GameResult } from '../models/game-result';
import { DEFAULT_SETTINGS, MotionPreference, Settings, ThemePreference } from '../models/settings';
import { BestScoreEntry, DEFAULT_STATS, Stats } from '../models/stats';
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
    v['quickPlayDurationSeconds'] <= 300
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

export interface RecordResultOutcome {
  readonly stats: Stats;
  readonly achievementsUnlocked: readonly AchievementId[];
  readonly isNewBest: boolean;
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
  readonly stats = signal<Stats>(this.read(STATS_KEY, isStats, DEFAULT_STATS));

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
    const achievementsUnlocked = evaluateAchievements(result, prior);

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

    const next: Stats = {
      bestScores,
      achievementsUnlocked: [...prior.achievementsUnlocked, ...achievementsUnlocked],
      roundsPlayed: prior.roundsPlayed + 1,
      totalWordsTyped: prior.totalWordsTyped + result.wordsCorrect,
      difficultiesBeaten,
    };

    this.stats.set(next);
    this.write(STATS_KEY, next);
    return { stats: next, achievementsUnlocked, isNewBest };
  }

  private onStorageEvent(event: StorageEvent): void {
    if (event.key === STATS_KEY) {
      this.stats.set(this.read(STATS_KEY, isStats, DEFAULT_STATS));
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
