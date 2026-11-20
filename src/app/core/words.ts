/**
 * Word selection and the Daily's calendar maths. Pure TypeScript, no
 * Angular imports, so the same inputs always give the same words.
 */
import { WORDS_PER_LEVEL, Word, WordSupply } from './engine';

export const GOLD_CHANCE = 0.08;
/** A word won't come back until this many others have been shown. */
const NO_REPEAT_WINDOW = 40;

/** mulberry32: small, fast, deterministic. Same seed, same sequence. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(hash, 31) + text.charCodeAt(i)) >>> 0;
  return hash;
}

/** Letter-count range for words at a given position. Starts at 3 to 5
 *  letters and widens towards long words as levels go up. */
export function lengthBand(index: number): readonly [number, number] {
  const level = 1 + Math.floor(index / WORDS_PER_LEVEL);
  return [Math.min(3 + Math.floor((level - 1) / 2), 8), Math.min(4 + level, 14)];
}

/** Keeps only plain lowercase words and drops duplicates. */
export function cleanPool(words: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const raw of words) {
    const word = raw.toLowerCase();
    if (/^[a-z]{3,14}$/.test(word)) seen.add(word);
  }
  return [...seen];
}

/**
 * A supply that climbs in word length as the run goes on. Calls must come
 * in index order (the engine guarantees it), which keeps the no-repeat
 * window deterministic for a seeded Daily.
 */
export function levelledSupply(pool: readonly string[], rng: () => number): WordSupply {
  const recent: string[] = [];
  return (index) => {
    const [min, max] = lengthBand(index);
    const fresh = (w: string) => !recent.includes(w);
    const inBand = pool.filter((w) => w.length >= min && w.length <= max);
    // A thin pool (offline, odd API reply) falls back to whatever is left.
    const candidates =
      [inBand.filter(fresh), pool.filter(fresh), pool].find((list) => list.length > 0) ?? [];
    const text = candidates[Math.floor(rng() * candidates.length)] ?? 'type';
    recent.push(text);
    if (recent.length > NO_REPEAT_WINDOW) recent.shift();
    return { text, gold: index > 0 && rng() < GOLD_CHANCE };
  };
}

export type KeyTally = Readonly<Record<string, readonly [hits: number, misses: number]>>;

/** Miss rate per letter, smoothed so a letter seen twice doesn't top the list. */
export function missRate(tally: KeyTally, letter: string): number {
  const [hits, misses] = tally[letter] ?? [0, 0];
  return (misses + 0.5) / (hits + misses + 10);
}

/** The letters you miss most, worst first. Needs a few misses to say anything. */
export function weakKeys(tally: KeyTally, count = 4): string[] {
  return Object.keys(tally)
    .filter((k) => tally[k][1] >= 2)
    .sort((a, b) => missRate(tally, b) - missRate(tally, a))
    .slice(0, count);
}

/**
 * Drill words: every word is scored by how many of your weak letters it
 * contains, and picks are biased towards the top of that list without
 * ever becoming the same few words.
 */
export function drillSupply(
  pool: readonly string[],
  weak: readonly string[],
  rng: () => number,
): WordSupply {
  const scored = pool
    .filter((w) => w.length <= 9)
    .map((w) => ({ w, s: [...w].filter((c) => weak.includes(c)).length / Math.sqrt(w.length) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 120)
    .map((x) => x.w);
  const recent: string[] = [];
  return (index) => {
    const fresh = scored.filter((w) => !recent.includes(w));
    // Squaring the roll leans picks towards the weakest-letter words.
    const text = fresh[Math.floor(rng() ** 2 * fresh.length)] ?? scored[0] ?? 'type';
    recent.push(text);
    if (recent.length > NO_REPEAT_WINDOW) recent.shift();
    return { text, gold: index > 0 && rng() < GOLD_CHANCE } satisfies Word;
  };
}

/* ---------- The Daily ---------- */

/** Daily #1 was played on this date. */
export const DAILY_EPOCH = '2026-07-09';

export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export function dailyNumber(date: string): number {
  return dayNumber(date) - dayNumber(DAILY_EPOCH) + 1;
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}
