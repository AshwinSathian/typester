import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';

import { ModeId, Summary } from './engine';
import { KeyTally, daysBetween } from './words';

export type Theme = 'system' | 'light' | 'dark';
export type Motion = 'system' | 'full' | 'reduced';

export interface Settings {
  readonly theme: Theme;
  readonly motion: Motion;
  readonly sound: boolean;
}

export interface Best {
  readonly score: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly level: number;
  readonly date: string;
  /** Word finish times, replayed as the ghost. */
  readonly wordTimes: readonly number[];
}

export interface RecentRun {
  readonly mode: ModeId;
  readonly score: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly date: string;
}

export interface Data {
  readonly version: 3;
  readonly settings: Settings;
  /** Personal best per mode. The Daily keeps one per date instead. */
  readonly best: Partial<Record<ModeId, Best>>;
  readonly daily: Readonly<Record<string, Best>>;
  readonly keys: KeyTally;
  readonly recent: readonly RecentRun[];
  readonly totals: { readonly runs: number; readonly words: number; readonly ms: number };
  /** Consecutive UTC days with at least one finished run. */
  readonly streak: { readonly days: number; readonly last: string; readonly longest: number };
}

export interface Recorded {
  readonly previousBest: Best | null;
  readonly isBest: boolean;
}

const KEY = 'typester';
const RECENT_LIMIT = 40;
const DAILY_KEEP_DAYS = 60;

export const DEFAULT_DATA: Data = {
  version: 3,
  settings: { theme: 'system', motion: 'system', sound: true },
  best: {},
  daily: {},
  keys: {},
  recent: [],
  totals: { runs: 0, words: 0, ms: 0 },
  streak: { days: 0, last: '', longest: 0 },
};

function isData(value: unknown): value is Data {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['version'] === 3 &&
    ['settings', 'best', 'daily', 'keys', 'totals', 'streak'].every(
      (k) => typeof v[k] === 'object' && v[k] !== null,
    ) &&
    Array.isArray(v['recent'])
  );
}

/** Streak after playing on `today`, given the stored streak. */
export function nextStreak(streak: Data['streak'], today: string): Data['streak'] {
  if (streak.last === today) return streak;
  const gap = streak.last ? daysBetween(streak.last, today) : Infinity;
  const days = gap === 1 ? streak.days + 1 : 1;
  return { days, last: today, longest: Math.max(streak.longest, days) };
}

/** The streak as it stands today: it only breaks once a whole day is missed. */
export function liveStreak(streak: Data['streak'], today: string): number {
  if (!streak.last) return 0;
  return daysBetween(streak.last, today) <= 1 ? streak.days : 0;
}

/**
 * Everything Typester remembers, in one localStorage entry. Unreadable or
 * older-format data falls back to defaults rather than breaking the app.
 */
@Service()
export class Store {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<Data>(this.load());

  readonly data = this.state.asReadonly();
  readonly settings = computed(() => this.state().settings);

  updateSettings(patch: Partial<Settings>): void {
    this.write({ ...this.state(), settings: { ...this.state().settings, ...patch } });
  }

  record(mode: ModeId, run: Summary, today: string): Recorded {
    const data = this.state();
    const entry: Best = {
      score: run.score,
      wpm: run.wpm,
      accuracy: run.accuracy,
      level: run.level,
      date: today,
      wordTimes: run.wordTimes,
    };
    const previousBest = mode === 'daily' ? (data.daily[today] ?? null) : (data.best[mode] ?? null);
    const isBest = run.score > 0 && run.score > (previousBest?.score ?? 0);

    const keys: Record<string, readonly [number, number]> = { ...data.keys };
    for (const letter of new Set([...Object.keys(run.hits), ...Object.keys(run.misses)])) {
      const [h, m] = keys[letter] ?? [0, 0];
      keys[letter] = [h + (run.hits[letter] ?? 0), m + (run.misses[letter] ?? 0)];
    }

    const daily = { ...data.daily };
    if (mode === 'daily' && isBest) daily[today] = entry;
    for (const date of Object.keys(daily)) {
      if (daysBetween(date, today) > DAILY_KEEP_DAYS) delete daily[date];
    }

    // A run you bailed on before typing a word shouldn't count as a day played.
    const played = run.words > 0;
    this.write({
      ...data,
      best: mode !== 'daily' && isBest ? { ...data.best, [mode]: entry } : data.best,
      daily,
      keys,
      recent: played
        ? [
            { mode, score: run.score, wpm: run.wpm, accuracy: run.accuracy, date: today },
            ...data.recent,
          ].slice(0, RECENT_LIMIT)
        : data.recent,
      totals: {
        runs: data.totals.runs + (played ? 1 : 0),
        words: data.totals.words + run.words,
        ms: data.totals.ms + run.durationMs,
      },
      streak: played ? nextStreak(data.streak, today) : data.streak,
    });
    return { previousBest, isBest };
  }

  /** Clears scores and history but keeps settings. */
  reset(): void {
    this.write({ ...DEFAULT_DATA, settings: this.state().settings });
  }

  private load(): Data {
    if (!this.browser) return DEFAULT_DATA;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (!isData(parsed)) return { ...DEFAULT_DATA, settings: this.legacySettings() };
      return { ...parsed, settings: { ...DEFAULT_DATA.settings, ...parsed.settings } };
    } catch {
      return DEFAULT_DATA;
    }
  }

  /** Carries theme, motion and sound over from the 2.x app (stored under v1). Its scores
   *  used a different scoring system, so those are left behind. */
  private legacySettings(): Settings {
    try {
      const old = JSON.parse(localStorage.getItem('typester:v1:settings') ?? '{}') as Record<
        string,
        unknown
      >;
      const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
        allowed.includes(value as T) ? (value as T) : fallback;
      return {
        theme: pick(old['theme'], ['system', 'light', 'dark'], 'system'),
        motion: pick(old['motion'], ['system', 'full', 'reduced'], 'system'),
        sound: old['soundEnabled'] !== false,
      };
    } catch {
      return DEFAULT_DATA.settings;
    }
  }

  private write(next: Data): void {
    this.state.set(next);
    if (!this.browser) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked (private mode): the session still works,
      // it just won't be remembered.
    }
  }
}
