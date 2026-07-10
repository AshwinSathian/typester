import { DEFAULT_STATS } from './stats';
import { allEndlessCombos, allGameCombos, gameConfigKey, nextUnbeatenCombo } from './game-config';

describe('allGameCombos', () => {
  it('enumerates exactly the 10-combo set: 1 Quick Play + 3 difficulties x 3 durations', () => {
    const combos = allGameCombos();
    expect(combos).toHaveLength(10);
    expect(combos.filter((c) => c.config.mode === 'quick')).toHaveLength(1);
    expect(combos.filter((c) => c.config.mode === 'timed')).toHaveLength(9);
  });

  it('produces unique keys for every combo', () => {
    const keys = allGameCombos().map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never includes an endless combo', () => {
    expect(allGameCombos().some((c) => c.config.mode === 'endless')).toBe(false);
  });
});

describe('allEndlessCombos', () => {
  it('enumerates exactly the 9-combo set: 3 difficulties x 3 lives counts', () => {
    const combos = allEndlessCombos();
    expect(combos).toHaveLength(9);
    expect(combos.every((c) => c.config.mode === 'endless')).toBe(true);
  });

  it('produces unique keys for every combo, disjoint from allGameCombos', () => {
    const keys = allEndlessCombos().map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);

    const gameKeys = new Set(allGameCombos().map((c) => c.key));
    expect(keys.some((key) => gameKeys.has(key))).toBe(false);
  });
});

describe('nextUnbeatenCombo', () => {
  const current = { mode: 'timed' as const, difficulty: 'easy' as const, durationSeconds: 30 };

  it('suggests the next combo in order when nothing is beaten yet', () => {
    const suggestion = nextUnbeatenCombo(DEFAULT_STATS, current);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.key).not.toBe(gameConfigKey(current));
  });

  it('never suggests a combo that already has a best score', () => {
    const combos = allGameCombos();
    const currentIndex = combos.findIndex((c) => c.key === gameConfigKey(current));
    const nextCombo = combos[(currentIndex + 1) % combos.length];

    const stats = {
      ...DEFAULT_STATS,
      bestScores: {
        [nextCombo.key]: { totalScore: 10, wpm: 20, accuracy: 1, achievedAt: '2026-01-01' },
      },
    };

    const suggestion = nextUnbeatenCombo(stats, current);
    expect(suggestion?.key).not.toBe(nextCombo.key);
  });

  it('returns null once every combo has a best score', () => {
    const bestScores = Object.fromEntries(
      allGameCombos().map((combo) => [
        combo.key,
        { totalScore: 1, wpm: 1, accuracy: 1, achievedAt: '2026-01-01' },
      ]),
    );
    const stats = { ...DEFAULT_STATS, bestScores };
    expect(nextUnbeatenCombo(stats, current)).toBeNull();
  });
});
