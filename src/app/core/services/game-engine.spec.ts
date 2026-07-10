import { DEFAULT_STATS } from '../models/stats';
import { GameConfig } from '../models/game-config';
import { WordEntry } from '../models/word';
import {
  GameSession,
  WordPools,
  buildRoundWords,
  closestAchievementMiss,
  diffAgainstTarget,
  escalateByLength,
  evaluateAchievements,
  isNearMiss,
  multiplierForStreak,
} from './game-engine';

const pools: WordPools = {
  easy: ['cat', 'dog', 'sun', 'run', 'top', 'hat', 'red', 'box'],
  medium: ['garden', 'planet', 'silver', 'window', 'castle', 'bridge'],
  hard: ['adventure', 'chocolate', 'important', 'community', 'wonderful'],
};

function sequentialRng(): () => number {
  // Deterministic, non-repeating sequence in [0, 1) so tests are reproducible.
  let n = 0;
  return () => {
    n = (n + 0.137) % 1;
    return n;
  };
}

function entry(text: string, difficulty: WordEntry['difficulty'] = 'easy'): WordEntry {
  return { text, difficulty, isPowerWord: false };
}

describe('multiplierForStreak', () => {
  it('is x1 below a 5-streak, x1.5 from 5-9, x2 at 10+', () => {
    expect(multiplierForStreak(0)).toBe(1);
    expect(multiplierForStreak(4)).toBe(1);
    expect(multiplierForStreak(5)).toBe(1.5);
    expect(multiplierForStreak(9)).toBe(1.5);
    expect(multiplierForStreak(10)).toBe(2);
    expect(multiplierForStreak(25)).toBe(2);
  });
});

describe('buildRoundWords', () => {
  it('builds a 4/4/2 easy/medium/hard composition for quick mode', () => {
    const config: GameConfig = { mode: 'quick', difficulty: 'mixed', durationSeconds: 90 };
    const words = buildRoundWords(config, pools, sequentialRng());

    expect(words).toHaveLength(10);
    expect(words.filter((w) => w.difficulty === 'easy')).toHaveLength(4);
    expect(words.filter((w) => w.difficulty === 'medium')).toHaveLength(4);
    expect(words.filter((w) => w.difficulty === 'hard')).toHaveLength(2);
  });

  it('draws the whole pool without replacement for timed mode', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'medium', durationSeconds: 60 };
    const words = buildRoundWords(config, pools, sequentialRng());

    expect(words).toHaveLength(pools.medium.length);
    expect(new Set(words.map((w) => w.text)).size).toBe(pools.medium.length);
    expect(words.every((w) => w.difficulty === 'medium')).toBe(true);
  });

  it('never marks the first word of a round as a power word', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'hard', durationSeconds: 30 };
    const words = buildRoundWords(config, pools, () => 0); // rng() always 0 -> would be a power word if allowed
    expect(words[0].isPowerWord).toBe(false);
  });

  it('escalates a timed round so its second half skews longer on average than its first half', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'hard', durationSeconds: 30 };
    const words = buildRoundWords(config, pools, sequentialRng());
    const midpoint = Math.floor(words.length / 2);
    const firstHalfAvg =
      words.slice(0, midpoint).reduce((sum, w) => sum + w.text.length, 0) / midpoint;
    const secondHalfAvg =
      words.slice(midpoint).reduce((sum, w) => sum + w.text.length, 0) / (words.length - midpoint);
    expect(secondHalfAvg).toBeGreaterThanOrEqual(firstHalfAvg);
  });
});

describe('escalateByLength', () => {
  it("groups shorter words before longer words, preserving each group's relative order", () => {
    // lengths: a=1, ccc=3, bb=2, dddd=4 -> median length 3 -> shorter group
    // keeps ["a","ccc","bb"] in their original relative order, then "dddd".
    const words = [entry('a'), entry('ccc'), entry('bb'), entry('dddd')];
    const result = escalateByLength(words);
    expect(result.map((w) => w.text)).toEqual(['a', 'ccc', 'bb', 'dddd']);
  });

  it('handles an empty or single-word list without throwing', () => {
    expect(escalateByLength([])).toEqual([]);
    expect(escalateByLength([entry('cat')])).toEqual([entry('cat')]);
  });
});

describe('isNearMiss', () => {
  it('is true for a single-character substitution, insertion, or deletion', () => {
    expect(isNearMiss('cot', 'cat')).toBe(true);
    expect(isNearMiss('cats', 'cat')).toBe(true);
    expect(isNearMiss('ca', 'cat')).toBe(true);
  });

  it('is false for an exact match or anything more than one edit away', () => {
    expect(isNearMiss('cat', 'cat')).toBe(false);
    expect(isNearMiss('dog', 'cat')).toBe(false);
    expect(isNearMiss('cot', 'cats')).toBe(false); // 2 edits (substitution + insertion)
  });

  it('is case-insensitive and trims whitespace, same as the exact-match check', () => {
    expect(isNearMiss('  COT  ', 'cat')).toBe(true);
  });
});

describe('GameSession', () => {
  const config: GameConfig = { mode: 'timed', difficulty: 'easy', durationSeconds: 30 };

  it('starts idle and rejects submit/result before start()', () => {
    const session = new GameSession(config, [entry('cat')]);
    expect(session.snapshot().state).toBe('idle');
    expect(() => session.submit('cat', 1000)).toThrow();
    expect(() => session.result()).toThrow();
  });

  it('rejects starting a session twice', () => {
    const session = new GameSession(config, [entry('cat')]);
    session.start(0);
    expect(() => session.start(100)).toThrow();
  });

  it('is case-insensitive and trims whitespace on submit', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    const outcome = session.submit('  CAT  ', 100);
    expect(outcome.correct).toBe(true);
  });

  it('advances only on a correct submission and resets streak on a mistake', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog'), entry('sun')]);
    session.start(0);

    session.submit('cat', 100);
    let snap = session.submit('cat', 200).snapshot; // wrong word for this position now ("dog")
    expect(snap.streak).toBe(0);
    expect(snap.wordIndex).toBe(1); // did not advance past "dog"

    snap = session.submit('dog', 300).snapshot;
    expect(snap.wordIndex).toBe(2);
    expect(snap.streak).toBe(1);
  });

  it('finishes and reports totals once every word is exhausted', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    session.submit('cat', 1_000);
    const outcome = session.submit('dog', 31_000); // 30s elapsed total
    expect(outcome.finished).toBe(true);
    expect(session.snapshot().state).toBe('finished');

    const result = session.result();
    expect(result.wordsCorrect).toBe(2);
    expect(result.wordsIncorrect).toBe(0);
    expect(result.accuracy).toBe(1);
  });

  it('applies streak multiplier and power-word doubling to score', () => {
    const words: WordEntry[] = [
      entry('cat'), // easy = 1pt, streak 1 -> x1 -> 1
      entry('dog'), // easy = 1pt, streak 2 -> x1 -> 1
      { text: 'sun', difficulty: 'easy', isPowerWord: true }, // 1pt * x1 * 2 = 2
    ];
    const session = new GameSession(config, words);
    session.start(0);
    session.submit('cat', 100);
    session.submit('dog', 200);
    const outcome = session.submit('sun', 300);

    expect(outcome.snapshot.score).toBe(1 + 1 + 2);
  });

  it('awards a time bonus only when the word list is exhausted before time runs out', () => {
    const exhaustedSession = new GameSession(config, [entry('cat')]);
    exhaustedSession.start(0);
    exhaustedSession.submit('cat', 10_000); // 10s of 30s used, 20s left over
    const exhaustedResult = exhaustedSession.result();
    expect(exhaustedResult.timeBonus).toBe(20);
    expect(exhaustedResult.totalScore).toBe(exhaustedResult.baseScore + 20);

    const timedOutSession = new GameSession(config, [entry('cat'), entry('dog')]);
    timedOutSession.start(0);
    timedOutSession.submit('cat', 10_000);
    timedOutSession.expireTime(30_000);
    expect(timedOutSession.result().timeBonus).toBe(0);
  });

  it('computes WPM from correct characters per minute elapsed', () => {
    // "cat" + "dog" = 6 correct chars, over exactly 6 seconds = 0.1 minutes -> 6/5/0.1 = 12 wpm
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    session.submit('cat', 3_000);
    session.submit('dog', 6_000);
    expect(session.result().wpm).toBe(12);
  });

  it('flags a near-miss (edit-distance-1) submission without treating it as correct', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    const outcome = session.submit('cot', 100);

    expect(outcome.correct).toBe(false);
    expect(outcome.nearMiss).toBe(true);
    expect(outcome.snapshot.wordIndex).toBe(0); // did not advance
    expect(outcome.snapshot.streak).toBe(0); // near-miss still resets the streak
  });

  it('does not flag a completely wrong word as a near-miss', () => {
    const session = new GameSession(config, [entry('cat')]);
    session.start(0);
    const outcome = session.submit('xyz', 100);

    expect(outcome.nearMiss).toBe(false);
  });

  it('exposes running correctChars in the snapshot for a live WPM reading', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    expect(session.snapshot().correctChars).toBe(0);
    session.submit('cat', 1_000);
    expect(session.snapshot().correctChars).toBe(3);
    session.submit('dog', 2_000);
    expect(session.snapshot().correctChars).toBe(6);
  });

  it('exposes the next 1-2 upcoming words for the look-ahead queue', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog'), entry('sun')]);
    session.start(0);
    expect(session.snapshot().upcomingWords.map((w) => w.text)).toEqual(['dog', 'sun']);

    session.submit('cat', 100);
    expect(session.snapshot().upcomingWords.map((w) => w.text)).toEqual(['sun']);

    session.submit('dog', 200);
    expect(session.snapshot().upcomingWords).toEqual([]);
  });

  it('livesRemaining is null for a quick/timed session with no mistake limit', () => {
    const session = new GameSession(config, [entry('cat')]);
    session.start(0);
    expect(session.snapshot().livesRemaining).toBeNull();
  });
});

describe('GameSession — Endless/Survival mode (mistakesAllowed)', () => {
  const config: GameConfig = { mode: 'endless', difficulty: 'easy', durationSeconds: 3 };

  it('reports lives remaining, decrementing on each mistake', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog'), entry('sun')], 3);
    session.start(0);
    expect(session.snapshot().livesRemaining).toBe(3);

    session.submit('wrong', 100);
    expect(session.snapshot().livesRemaining).toBe(2);
  });

  it('ends the round on the Nth mistake, independent of whether words remain', () => {
    const session = new GameSession(
      config,
      [entry('cat'), entry('dog'), entry('sun'), entry('run')],
      2,
    );
    session.start(0);

    session.submit('wrong', 100);
    const outcome = session.submit('wrong-again', 200);

    expect(outcome.finished).toBe(true);
    expect(session.snapshot().state).toBe('finished');
    expect(session.snapshot().livesRemaining).toBe(0);
    // Two words were never even reached - ending on mistakes, not exhaustion.
    expect(session.snapshot().wordIndex).toBeLessThan(4);
  });

  it('does not regress the existing timed-mode exhaustion end condition', () => {
    const timedConfig: GameConfig = { mode: 'timed', difficulty: 'easy', durationSeconds: 30 };
    const session = new GameSession(timedConfig, [entry('cat')]);
    session.start(0);
    const outcome = session.submit('cat', 100);
    expect(outcome.finished).toBe(true);
  });

  it('a correct submission before the mistake limit does not end the round early', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')], 3);
    session.start(0);
    const outcome = session.submit('cat', 100);
    expect(outcome.finished).toBe(false);
  });

  it('never awards a time bonus, even when the word pool is exhausted well inside the "lives" count treated as seconds', () => {
    // config.durationSeconds is 3 here, meaning 3 lives - not 3 seconds.
    // Exhausting a short word list in under 3 real seconds would previously
    // misread that as "3000ms - elapsedMs" seconds left on a nonexistent
    // clock and award a bogus bonus. Endless has no clock; it must always
    // be 0, regardless of how fast the round finished.
    const session = new GameSession(config, [entry('cat'), entry('dog')], 10);
    session.start(0);
    session.submit('cat', 500);
    session.submit('dog', 900); // word list exhausted after 900ms, well under 3000ms
    const result = session.result();

    expect(result.timeBonus).toBe(0);
    expect(result.totalScore).toBe(result.baseScore);
  });
});

describe('evaluateAchievements', () => {
  const baseResult = {
    config: { mode: 'timed', difficulty: 'easy', durationSeconds: 30 } as GameConfig,
    wordsCorrect: 5,
    wordsIncorrect: 0,
    baseScore: 10,
    timeBonus: 0,
    totalScore: 10,
    wpm: 30,
    accuracy: 1,
    bestStreak: 5,
    achievementsUnlocked: [],
    finishedAt: new Date(0).toISOString(),
  };

  it("unlocks first-round only on a player's first-ever round", () => {
    expect(evaluateAchievements(baseResult, DEFAULT_STATS)).toContain('first-round');
    const seasoned = { ...DEFAULT_STATS, roundsPlayed: 5 };
    expect(evaluateAchievements(baseResult, seasoned)).not.toContain('first-round');
  });

  it('unlocks wpm-50 at 50+ wpm and not below', () => {
    expect(evaluateAchievements({ ...baseResult, wpm: 50 }, DEFAULT_STATS)).toContain('wpm-50');
    expect(evaluateAchievements({ ...baseResult, wpm: 49 }, DEFAULT_STATS)).not.toContain('wpm-50');
  });

  it('unlocks perfect-accuracy only at 100% accuracy with at least one correct word', () => {
    expect(evaluateAchievements(baseResult, DEFAULT_STATS)).toContain('perfect-accuracy');
    expect(evaluateAchievements({ ...baseResult, accuracy: 0.99 }, DEFAULT_STATS)).not.toContain(
      'perfect-accuracy',
    );
  });

  it('unlocks streak-10 at a 10+ best streak', () => {
    expect(evaluateAchievements({ ...baseResult, bestStreak: 10 }, DEFAULT_STATS)).toContain(
      'streak-10',
    );
    expect(evaluateAchievements({ ...baseResult, bestStreak: 9 }, DEFAULT_STATS)).not.toContain(
      'streak-10',
    );
  });

  it('unlocks all-difficulties once every difficulty has a best score', () => {
    const almost = { ...DEFAULT_STATS, difficultiesBeaten: ['medium', 'hard'] as const };
    expect(
      evaluateAchievements(
        { ...baseResult, config: { ...baseResult.config, difficulty: 'easy' } },
        almost,
      ),
    ).toContain('all-difficulties');
  });

  it('never re-unlocks an achievement already present in priorStats', () => {
    const already = { ...DEFAULT_STATS, achievementsUnlocked: ['first-round', 'wpm-50'] as const };
    const unlocked = evaluateAchievements({ ...baseResult, wpm: 60 }, already);
    expect(unlocked).not.toContain('first-round');
    expect(unlocked).not.toContain('wpm-50');
  });

  it('unlocks every WPM Club tier at or below the achieved WPM', () => {
    const unlocked = evaluateAchievements({ ...baseResult, wpm: 75 }, DEFAULT_STATS);
    expect(unlocked).toEqual(expect.arrayContaining(['wpm-30', 'wpm-50', 'wpm-70']));
    expect(unlocked).not.toContain('wpm-90');
    expect(unlocked).not.toContain('wpm-110');
  });

  it('unlocks day-streak milestones from the freshly-computed current streak, not priorStats', () => {
    const unlocked = evaluateAchievements(baseResult, DEFAULT_STATS, 7);
    expect(unlocked).toContain('streak-day-7');
    expect(unlocked).not.toContain('streak-day-30');
  });

  it('does not re-unlock a day-streak milestone already present in priorStats', () => {
    const already = { ...DEFAULT_STATS, achievementsUnlocked: ['streak-day-7'] as const };
    const unlocked = evaluateAchievements(baseResult, already, 10);
    expect(unlocked).not.toContain('streak-day-7');
  });
});

describe('closestAchievementMiss', () => {
  const baseResult = {
    config: { mode: 'timed', difficulty: 'easy', durationSeconds: 30 } as GameConfig,
    wordsCorrect: 5,
    wordsIncorrect: 0,
    baseScore: 10,
    timeBonus: 0,
    totalScore: 10,
    wpm: 24,
    accuracy: 0.9,
    bestStreak: 0,
    achievementsUnlocked: [],
    finishedAt: new Date(0).toISOString(),
  };

  it('reports the closest not-yet-unlocked achievement as a human-readable gap', () => {
    // 24 wpm -> 6 short of the 30 WPM Club, the closest computable gap here.
    expect(closestAchievementMiss(baseResult, DEFAULT_STATS, 0)).toBe(
      '6 more WPM for the 30 WPM Club',
    );
  });

  it('returns null once nothing computable remains open', () => {
    const maxedOut = {
      ...DEFAULT_STATS,
      achievementsUnlocked: [
        'wpm-30',
        'wpm-50',
        'wpm-70',
        'wpm-90',
        'wpm-110',
        'streak-10',
        'streak-day-7',
        'streak-day-30',
        'streak-day-100',
      ] as const,
    };
    expect(
      closestAchievementMiss({ ...baseResult, wpm: 150, bestStreak: 10 }, maxedOut, 100),
    ).toBeNull();
  });
});

describe('diffAgainstTarget', () => {
  it('flags nothing when the typed value matches exactly', () => {
    expect(diffAgainstTarget('cat', 'cat')).toEqual([false, false, false]);
  });

  it('flags only the substituted character, not the whole tail', () => {
    // "cot" vs "cat" - a single substitution at index 1.
    expect(diffAgainstTarget('cot', 'cat')).toEqual([false, true, false]);
  });

  it('does not cascade a single deletion into every character after it', () => {
    // "anticipaton" is "anticipation" missing one 'i' - a single deletion,
    // not three wrong characters. A naive positional compare would flag
    // everything from the deletion point onward.
    const diff = diffAgainstTarget('anticipaton', 'anticipation');
    expect(diff.filter(Boolean)).toHaveLength(0);
  });

  it('flags an inserted extra character, not everything after it', () => {
    // "catt" vs "cat" - one extra trailing character.
    expect(diffAgainstTarget('catt', 'cat')).toEqual([false, false, false, true]);
  });

  it('is case-insensitive, matching the engine-wide normalization rule', () => {
    expect(diffAgainstTarget('CAT', 'cat')).toEqual([false, false, false]);
  });

  it('flags every character of a completely different typed value', () => {
    expect(diffAgainstTarget('xyz', 'cat')).toEqual([true, true, true]);
  });
});
