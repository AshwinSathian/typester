/**
 * Pure TypeScript daily-challenge helpers - zero Angular imports (see
 * ARCHITECTURE.md §D4, PLAN-typester-growth.md architecture table). Derives
 * a deterministic seed from a UTC calendar date so every player gets
 * byte-identical word order for "today", feeding the same injectable `rng`
 * parameter `buildRoundWords()` already accepts - this is a drop-in
 * extension point, not new engine architecture.
 */
import { DailyChallenge } from '../models/daily-challenge';
import { GameConfig } from '../models/game-config';

/** Fixed config every daily challenge uses - medium difficulty, 60s, timed
 *  mode. Comparable across players by construction (same config + same
 *  seed => same words), unlike a per-round Datamuse fetch. */
export const DAILY_CHALLENGE_CONFIG: GameConfig = {
  mode: 'timed',
  difficulty: 'medium',
  durationSeconds: 60,
};

/** The date "Typester Daily #1" launched - everything before this has no
 *  day number. Chosen as this RFC's own creation date. */
export const DAILY_CHALLENGE_EPOCH = '2026-07-09';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUtcDate(dateUtc: string): Date {
  return new Date(`${dateUtc}T00:00:00.000Z`);
}

/** True only for a well-formed, calendar-valid `YYYY-MM-DD` string. */
export function isValidDailyDateFormat(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = parseUtcDate(date);
  return !Number.isNaN(parsed.getTime()) && utcDateString(parsed) === date;
}

/** A daily date is playable once it's a valid format and not in the future
 *  relative to `todayUtc` - "tomorrow's" challenge doesn't exist yet. */
export function isDailyDateAllowed(date: string, todayUtc: string): boolean {
  return isValidDailyDateFormat(date) && date <= todayUtc;
}

/** Deterministic 32-bit hash of the date string - same date always hashes
 *  to the same seed, different dates (almost certainly) don't collide. */
export function dailySeed(dateUtc: string): number {
  let hash = 0;
  for (let i = 0; i < dateUtc.length; i++) {
    hash = (Math.imul(hash, 31) + dateUtc.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** mulberry32 - a small, fast, deterministic PRNG. Same seed -> same
 *  infinite sequence, which is exactly what `buildRoundWords()`'s `rng`
 *  parameter needs for two independent calls to agree. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole calendar days between two UTC `YYYY-MM-DD` dates. */
function daysBetweenUtc(fromUtc: string, toUtc: string): number {
  const msPerDay = 86_400_000;
  return Math.round((parseUtcDate(toUtc).getTime() - parseUtcDate(fromUtc).getTime()) / msPerDay);
}

/** "Typester Daily #N" - 1 on the epoch date, 2 the day after, etc. */
export function dailyChallengeNumber(dateUtc: string): number {
  return daysBetweenUtc(DAILY_CHALLENGE_EPOCH, dateUtc) + 1;
}

export function buildDailyChallenge(dateUtc: string): DailyChallenge {
  return {
    date: dateUtc,
    seed: dailySeed(dateUtc),
    config: DAILY_CHALLENGE_CONFIG,
    dayNumber: dailyChallengeNumber(dateUtc),
  };
}

/** Add (or subtract) whole days from a UTC `YYYY-MM-DD` date string. */
export function addUtcDays(dateUtc: string, days: number): string {
  const d = parseUtcDate(dateUtc);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateString(d);
}
